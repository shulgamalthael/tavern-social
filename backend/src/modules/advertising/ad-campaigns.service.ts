import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AdCampaign, AdCreative, AdPlacement } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  convertUsingRates,
  ExchangeRatesService,
} from '@/modules/currencies/exchange-rates.service';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { PaymentAmountTooLowError } from '@/modules/payments/payments.types';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import type { AddAdCreativeDto } from './dto/add-ad-creative.dto';
import type { CreateAdCampaignDto } from './dto/create-ad-campaign.dto';
import type { TopUpAdCampaignDto } from './dto/top-up-ad-campaign.dto';
import {
  toAdCampaignDto,
  toAdCreativeDto,
  type AdCampaignDto,
  type AdCreativeDto,
  type PlacementInsightDto,
} from './advertising.types';
import { AdEngineService } from './ad-engine.service';
import { calculateClearingPriceCents } from './lib/clearing-price';
import { calculateCtr, calculateEffectiveCpmCents } from './lib/effective-bid';
import { AD_PLACEMENT_ALLOWED_FORMATS } from './lib/ad-placement-config';
import { findRestrictedKeywordMatch } from './lib/restricted-keywords';

type CampaignWithCreatives = AdCampaign & { creatives: AdCreative[] };

/** Реальный контекст показа/клика, нужный `refreshClearingPrice` — см. её
 * комментарий и `recordImpression`'s. Оба вызывающих контроллера
 * (`PublicSitesController`/`FeedAdsController`) собирают это сами, ничего
 * из этого не приходит готовым от одного общего источника. */
interface AdEventContext {
  placement: AdPlacement | undefined;
  publisherBusinessId: string | null;
  visitorCountry: string | null;
}

/** Тот же закрытый набор значений, что и ключи `AD_PLACEMENT_ALLOWED_FORMATS`
 * (`lib/ad-placement-config.ts`) — отдельная константа здесь, а не импорт
 * оттуда, потому что там это ключи объекта конфигурации форматов, а не
 * самостоятельный список; дублировать шесть строковых литералов дешевле,
 * чем городить общий экспорт ради одного места использования. */
const ALL_AD_PLACEMENTS: AdPlacement[] = [
  'header',
  'content',
  'sidebar',
  'footer',
  'in_feed',
  'feed_sidebar',
];

/**
 * Self-service self-serve кампании (согласовано с владельцем — «Self-service
 * для любого Business», НЕ admin-only) — тот же owner-scoped паттерн, что
 * `CustomWidgetsService`/`OrdersService`: `assertOwnership` на каждый
 * владелец-вызов, `findOwnedCampaign` для операций над конкретной кампанией.
 *
 * Оплата — ТРЕТИЙ вызывающий уже существующего `PaymentProvider`
 * (`createPaymentIntent`/`verifyWebhookSignature`), рядом с `Order` и
 * `Appointment` — ни одной новой строчки интеграции со Stripe, см. корневой
 * план фичи §3. В отличие от `Order` (честный заказ без оплаты — валидный
 * промежуточный статус, продавец обрабатывает вручную), кампания без оплаты
 * не имеет смысла продолжать — поэтому `submitForReview` бросает, если
 * `PaymentProvider` не настроен или платёж не удался, а не тихо
 * деградирует.
 */
@Injectable()
export class AdCampaignsService {
  private readonly logger = new Logger(AdCampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProvider,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly adEngineService: AdEngineService,
  ) {}

  async list(businessId: string, ownerId: string): Promise<AdCampaignDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { advertiserBusinessId: businessId },
      include: { creatives: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  /** Счётчик активных (`status: 'active', paymentStatus: 'paid'`) кампаний
   * на место — «популярное» место — где много активных кампаний (высокий
   * спрос), «свободное» — где мало (меньше конкуренции за показ);
   * сортировку по этим двум осям делает уже вызывающий (frontend), не этот
   * метод. Считается в памяти после одного `findMany` — реалистичный
   * сегодня объём активных кампаний не требует raw SQL по array-колонке
   * `targetPlacements` (Prisma не умеет `groupBy` по элементам массива),
   * тот же принцип «не строить впрок сложную агрегацию», что уже у
   * `AdvertisingInventoryService.getInventory` (тоже считает на лету).
   *
   * `avgEffectiveCpmUsdCents` — средний eCPM конкурирующих кампаний,
   * ПРИВЕДЁННЫЙ К USD через `ExchangeRatesService` (у разных рекламодателей
   * разная `AdCampaign.currency` — усреднять сырые центы без приведения к
   * одной валюте методологически неверно, см. `PlacementInsightDto`'s
   * комментарий). Кампания, чью валюту `ExchangeRatesService` сейчас не
   * может конвертировать (курс недоступен ИЛИ ЕЦБ не публикует курс для
   * этой валюты, например `UAH`), просто не участвует в среднем — но
   * по-прежнему считается в `activeCampaignCount` (это не денежная
   * метрика, ей конвертация не нужна). */
  async getPlacementInsights(businessId: string, ownerId: string): Promise<PlacementInsightDto[]> {
    await this.assertOwnership(businessId, ownerId);

    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'active', paymentStatus: 'paid' },
      select: {
        targetPlacements: true,
        billingModel: true,
        bidCents: true,
        impressionsServed: true,
        clicksServed: true,
        currency: true,
      },
    });

    const counts = Object.fromEntries(
      ALL_AD_PLACEMENTS.map((placement) => [placement, 0]),
    ) as Record<AdPlacement, number>;
    const usdEcpmByPlacement = Object.fromEntries(
      ALL_AD_PLACEMENTS.map((placement) => [placement, [] as number[]]),
    ) as Record<AdPlacement, number[]>;

    // Один Redis-запрос за курсами на весь список кампаний, а не по одному
    // на кампанию — см. `convertUsingRates`'s комментарий.
    const rates = await this.exchangeRatesService.getRatesToUsd();

    for (const campaign of campaigns) {
      const effectiveCpmCents = calculateEffectiveCpmCents(campaign);
      const usdCents = convertUsingRates(effectiveCpmCents, campaign.currency, rates);
      for (const placement of campaign.targetPlacements) {
        counts[placement] += 1;
        if (usdCents !== null) usdEcpmByPlacement[placement].push(usdCents);
      }
    }

    return ALL_AD_PLACEMENTS.map((placement) => {
      const usdValues = usdEcpmByPlacement[placement];
      const avgEffectiveCpmUsdCents =
        usdValues.length > 0
          ? Math.round(usdValues.reduce((sum, value) => sum + value, 0) / usdValues.length)
          : null;
      return { placement, activeCampaignCount: counts[placement], avgEffectiveCpmUsdCents };
    });
  }

  async get(businessId: string, campaignId: string, ownerId: string): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    return toAdCampaignDto(campaign);
  }

  async create(
    businessId: string,
    ownerId: string,
    dto: CreateAdCampaignDto,
  ): Promise<AdCampaignDto> {
    const business = await this.assertOwnership(businessId, ownerId);
    await this.assertNotBannedAdvertiser(businessId);

    const campaign = await this.prisma.adCampaign.create({
      data: {
        advertiserBusinessId: businessId,
        name: dto.name,
        budgetCents: dto.budgetCents,
        currency: business.currency,
        billingModel: dto.billingModel,
        bidCents: dto.bidCents,
        targetCategories: dto.targetCategories ?? [],
        targetPlacements: dto.targetPlacements,
        targetDevices: dto.targetDevices ?? [],
        targetCountries: dto.targetCountries ?? [],
        isAdultContent: dto.isAdultContent ?? false,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
      include: { creatives: true },
    });
    return toAdCampaignDto(campaign);
  }

  /** Ограничено статусом `draft` — после отправки на модерацию (`submitFor
   * Review`) креативы кампании больше не редактируются здесь: реальный
   * бюджет уже списывается на согласованное содержимое, произвольная
   * подмена креатива постфактум была бы способом обойти модерацию. */
  async addCreative(
    businessId: string,
    campaignId: string,
    ownerId: string,
    dto: AddAdCreativeDto,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException(
        'Добавлять креативы можно только к кампании в статусе "черновик"',
      );
    }

    if (dto.productId) {
      // Карточка товара — снимаем слепок name/description/images[0] РОВНО
      // ОДИН РАЗ здесь, не доверяя присланным клиентом format/headline/
      // description/imageUrl (см. комментарий `AddAdCreativeDto`), и
      // игнорируя их, даже если клиент всё же прислал.
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product || product.businessId !== businessId || !product.isActive) {
        throw new BadRequestException('Товар не найден или недоступен для рекламы');
      }

      // Карточка товара всегда `format: 'card'` — если ни одно из мест
      // размещения кампании физически не вмещает этот формат (см.
      // `AD_PLACEMENT_ALLOWED_FORMATS`, например кампания только с
      // `header`/`footer`), `AdEngineService.selectCreative` никогда не
      // отберёт этот креатив — кампания будет числиться активной и
      // оплаченной, но реально никогда не показываться. Лучше отказать
      // здесь явно, чем дать рекламодателю молча платить за показы,
      // которых не будет.
      const fitsAnyTargetPlacement = campaign.targetPlacements.some((placement) =>
        AD_PLACEMENT_ALLOWED_FORMATS[placement].includes('card'),
      );
      if (!fitsAnyTargetPlacement) {
        throw new BadRequestException(
          'Карточка товара не помещается ни в одно из выбранных мест размещения этой кампании',
        );
      }

      // Compliance rule-engine (см. `findRestrictedKeywordMatch`'s
      // комментарий) — проверяем СНЯТЫЙ СЛЕПОК (headline/description
      // товара), не сам товар: рекламный текст должен быть чист, даже если
      // сам магазин легитимно продаёт что-то из ограниченного списка (спор
      // о легитимности самого товара — не задача этой проверки).
      const restrictedMatch = findRestrictedKeywordMatch(product.name, product.description);

      await this.prisma.adCreative.create({
        data: {
          campaignId,
          productId: product.id,
          format: 'card',
          headline: product.name,
          description: product.description || null,
          imageUrl: product.images[0] ?? null,
          ctaLabel: dto.ctaLabel ?? null,
          targetUrl: dto.targetUrl,
          ...(restrictedMatch
            ? {
                status: 'rejected',
                rejectionReason: `Автоматически отклонено: обнаружено слово «${restrictedMatch.keyword}» (тема: ${restrictedMatch.topic})`,
              }
            : {}),
        },
      });
    } else {
      if (!dto.format || !dto.headline) {
        throw new BadRequestException('Укажите формат и заголовок, либо выберите товар');
      }

      if (dto.format === 'video' && !dto.videoUrl) {
        throw new BadRequestException('Формат "video" требует videoUrl');
      }
      if (dto.format !== 'video' && dto.videoUrl) {
        throw new BadRequestException('videoUrl допустим только для формата "video"');
      }

      if (dto.imageUrl || dto.videoUrl) {
        const ownedAssets = await this.mediaAssetsService.list(businessId, ownerId);
        const ownedUrls = new Set(ownedAssets.map((asset) => asset.url));
        if (dto.imageUrl && !ownedUrls.has(dto.imageUrl)) {
          throw new BadRequestException(
            'imageUrl должен быть файлом, уже загруженным для этого бизнеса',
          );
        }
        if (dto.videoUrl && !ownedUrls.has(dto.videoUrl)) {
          throw new BadRequestException(
            'videoUrl должен быть файлом, уже загруженным для этого бизнеса',
          );
        }
      }

      // Compliance rule-engine — см. комментарий в `productId`-ветке выше.
      const restrictedMatch = findRestrictedKeywordMatch(dto.headline, dto.description);

      await this.prisma.adCreative.create({
        data: {
          campaignId,
          format: dto.format,
          headline: dto.headline,
          description: dto.description ?? null,
          imageUrl: dto.imageUrl ?? null,
          videoUrl: dto.videoUrl ?? null,
          ctaLabel: dto.ctaLabel ?? null,
          targetUrl: dto.targetUrl,
          ...(restrictedMatch
            ? {
                status: 'rejected',
                rejectionReason: `Автоматически отклонено: обнаружено слово «${restrictedMatch.keyword}» (тема: ${restrictedMatch.topic})`,
              }
            : {}),
        },
      });
    }

    const updated = await this.findOwnedCampaign(businessId, campaignId);
    return toAdCampaignDto(updated);
  }

  async removeCreative(
    businessId: string,
    campaignId: string,
    creativeId: string,
    ownerId: string,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Удалять креативы можно только из черновика');
    }
    const creative = campaign.creatives.find((item) => item.id === creativeId);
    if (!creative) throw new NotFoundException('Креатив не найден');

    await this.prisma.adCreative.delete({ where: { id: creativeId } });
    const updated = await this.findOwnedCampaign(businessId, campaignId);
    return toAdCampaignDto(updated);
  }

  /** Создаёт `PaymentIntent` на весь `budgetCents` кампании (см. `Payment
   * Provider.createPaymentIntent`, тот же вызов, что `OrdersService.
   * createFromCart`) и переводит кампанию в `pending_review` — оплата не
   * равна одобрению, см. `markPaidByPaymentIntent`/`approve` ниже: платёж
   * подтверждает готовность рекламодателя платить, модерация — что
   * содержимое допустимо к показу. */
  async submitForReview(
    businessId: string,
    campaignId: string,
    ownerId: string,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    await this.assertNotBannedAdvertiser(businessId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'draft') {
      throw new BadRequestException('Кампания уже отправлена на модерацию или обработана');
    }
    if (campaign.creatives.length === 0) {
      throw new BadRequestException('Добавьте хотя бы один креатив перед отправкой на модерацию');
    }
    if (!this.paymentProvider.isConfigured()) {
      throw new BadRequestException('Приём оплаты временно недоступен, попробуйте позже');
    }

    let paymentIntentId: string;
    let clientSecret: string;
    try {
      const result = await this.paymentProvider.createPaymentIntent({
        amountCents: campaign.budgetCents,
        currency: campaign.currency,
        metadata: { campaignId: campaign.id, businessId },
      });
      paymentIntentId = result.paymentIntentId;
      clientSecret = result.clientSecret;
    } catch (error) {
      const message =
        error instanceof PaymentAmountTooLowError
          ? 'Бюджет кампании слишком мал для оплаты'
          : 'Не удалось создать платёж — попробуйте позже';
      this.logger.error(
        `Не удалось создать PaymentIntent для кампании ${campaign.id}: ${(error as Error).message}`,
      );
      throw new BadRequestException(message);
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: 'pending_review', stripePaymentIntentId: paymentIntentId },
      include: { creatives: true },
    });
    return toAdCampaignDto(updated, clientSecret);
  }

  /** Вызывается только вебхуком Stripe (`StripeWebhookController`) — не
   * owner-CRUD путь, тот же принцип, что `OrdersService.
   * markPaidByPaymentIntent`. НЕ активирует кампанию — статус остаётся
   * `pending_review` до ручного решения администратора (`approve`/
   * `reject` ниже), оплата и модерация — независимые условия. */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!campaign) {
      this.logger.warn(`Вебхук Stripe для неизвестной рекламной кампании ${paymentIntentId}`);
      return;
    }
    await this.prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { paymentStatus: 'paid' },
    });
  }

  /** Закрывает §68.8's "extending/topping up a paused campaign's budget"
   * gap — см. `AdCampaignTopUp`'s комментарий в schema.prisma. Только для
   * `status: 'paused'` — сегодня единственный способ туда попасть это
   * автопауза по исчерпанию бюджета (`applySpend`), доплата бюджета имеет
   * смысл ровно в этом случае; `draft`/`pending_review`/`active`/`rejected`
   * кампании доплату не принимают (`active` ещё не исчерпала бюджет —
   * доплачивать нечему, `draft`/`pending_review`/`rejected` вообще не были
   * одобрены к показу).
   *
   * Отдельный `PaymentIntent` на каждую доплату (см. `AdCampaignTopUp`'s
   * комментарий) — ledger-строка создаётся ДО вызова `createPaymentIntent`,
   * не после: её `id` генерируется заранее (`randomUUID()`) именно чтобы
   * быть стабильно известным ключом поиска ДО того, как Stripe вообще
   * узнал об этой доплате, а не только чтобы попасть в metadata. Если бы
   * порядок был обратным (сначала `createPaymentIntent`, потом `create`
   * строки, как исходно и было сделано здесь) — обрыв связи между реальным
   * успешным списанием у Stripe и ЕЩЁ не записанной строкой ledger навсегда
   * терял бы деньги рекламодателя: `markTopUpPaidByPaymentIntent` ищет по
   * `stripePaymentIntentId`, а этого поля просто не существовало бы нигде
   * в БД, если `create` не успел выполниться до прихода вебхука. Строка
   * теперь всегда существует до звонка в Stripe (`stripePaymentIntentId:
   * null` первый момент), поэтому дальше нужно только ДОПИСАТЬ её тем же
   * `id`, а не найти заново по значению, которого могло не быть. */
  async requestTopUp(
    businessId: string,
    campaignId: string,
    ownerId: string,
    dto: TopUpAdCampaignDto,
  ): Promise<AdCampaignDto> {
    await this.assertOwnership(businessId, ownerId);
    await this.assertNotBannedAdvertiser(businessId);
    const campaign = await this.findOwnedCampaign(businessId, campaignId);
    if (campaign.status !== 'paused') {
      throw new BadRequestException(
        'Доплатить бюджет можно только у кампании, приостановленной из-за исчерпания бюджета',
      );
    }
    if (!this.paymentProvider.isConfigured()) {
      throw new BadRequestException('Приём оплаты временно недоступен, попробуйте позже');
    }

    const topUpId = randomUUID();
    await this.prisma.adCampaignTopUp.create({
      data: { id: topUpId, campaignId: campaign.id, amountCents: dto.amountCents },
    });

    let clientSecret: string;
    try {
      const result = await this.paymentProvider.createPaymentIntent({
        amountCents: dto.amountCents,
        currency: campaign.currency,
        metadata: { adTopUpId: topUpId, campaignId: campaign.id, businessId },
      });
      // Может не успеть выполниться (сеть/БД оборвалась ПОСЛЕ того, как
      // Stripe уже реально списал деньги) — тогда строка остаётся без
      // `stripePaymentIntentId`, но `markTopUpPaidByPaymentIntent` всё
      // равно находит и дозаполняет её по СВОЕМУ `id` (`adTopUpId` из
      // metadata вебхука), не по этому полю — см. её комментарий.
      await this.prisma.adCampaignTopUp.update({
        where: { id: topUpId },
        data: { stripePaymentIntentId: result.paymentIntentId },
      });
      clientSecret = result.clientSecret;
    } catch (error) {
      const message =
        error instanceof PaymentAmountTooLowError
          ? 'Сумма доплаты слишком мала для оплаты'
          : 'Не удалось создать платёж — попробуйте позже';
      this.logger.error(
        `Не удалось создать доплату бюджета для кампании ${campaign.id}: ${(error as Error).message}`,
      );
      throw new BadRequestException(message);
    }

    return toAdCampaignDto(campaign, clientSecret);
  }

  /** Вызывается только вебхуком Stripe, симметрично `markPaidByPaymentIntent`
   * выше — но, в отличие от неё, реально двигает деньги в БД (увеличивает
   * `budgetCents`), а не просто помечает статус, поэтому нуждается в защите
   * от повторной доставки того же вебхука (Stripe документированно может
   * прислать `payment_intent.succeeded` больше одного раза): `updateMany`
   * с условием `paymentStatus: 'unpaid'` в `WHERE` атомарно гарантирует, что
   * зачисление бюджета произойдёт РОВНО один раз даже при дублирующей
   * доставке — второй вызов увидит `count: 0` и тихо остановится, не
   * начислив тот же топ-ап дважды.
   *
   * Ищет строку по `adTopUpId` (её собственный `id`, известный с момента
   * `requestTopUp`'s `create`) — НЕ по `stripePaymentIntentId`, хотя оно
   * тоже приходит в metadata: строка создаётся раньше, чем `stripePaymentIntentId`
   * дозаписывается в неё (см. `requestTopUp`'s комментарий), так что поиск
   * по нему потерял бы ровно те доплаты, где это дозаполнение не успело
   * выполниться после реального успешного списания у Stripe — самый
   * дорогой момент для потери связи. Заодно дозаполняет `stripePaymentIntentId`,
   * если он почему-то ещё пуст — тот случай.
   *
   * Возвращает кампанию из `paused` в `active`, только если доплаченного
   * бюджета хватает покрыть уже потраченное (`budgetCents > spentCents`
   * после начисления) — иначе кампания честно остаётся `paused` (доплата
   * меньше уже потраченного, хоть и учтена, реально ничего не открывает). */
  async markTopUpPaidByPaymentIntent(paymentIntentId: string, topUpId: string): Promise<void> {
    const topUp = await this.prisma.adCampaignTopUp.findUnique({ where: { id: topUpId } });
    if (!topUp) {
      this.logger.warn(
        `Вебхук Stripe для неизвестной доплаты рекламной кампании ${topUpId} (${paymentIntentId})`,
      );
      return;
    }

    const claimed = await this.prisma.adCampaignTopUp.updateMany({
      where: { id: topUp.id, paymentStatus: 'unpaid' },
      data: { paymentStatus: 'paid', stripePaymentIntentId: paymentIntentId },
    });
    if (claimed.count === 0) return;

    const campaign = await this.prisma.adCampaign.update({
      where: { id: topUp.campaignId },
      data: { budgetCents: { increment: topUp.amountCents } },
    });
    if (campaign.status === 'paused' && campaign.budgetCents > campaign.spentCents) {
      await this.prisma.adCampaign.update({
        where: { id: campaign.id },
        data: { status: 'active' },
      });
    }
  }

  /** Реальное списание уже оплаченного `budgetCents` (см. `AdBillingModel`'s
   * комментарий) — вызывается из `PublicSitesController.recordAdImpression`
   * рядом с (не вместо) записью в `AnalyticsEvent`, fire-and-forget, не
   * должен уронить сам показ посетителю при сбое (тот же принцип, что и у
   * `AnalyticsService.record`).
   *
   * `impressionsServed` инкрементируется ВСЕГДА (нужен для честной
   * CTR-статистики независимо от модели биллинга) — но `spentCents`
   * пересчитывается из него заново только для `billingModel: 'cpm'`;
   * `cpc`-кампания получает бесплатные показы, платит только за клик (см.
   * `recordClick`), стандартное для рекламных сетей разделение.
   *
   * Не атомарно одним запросом (инкремент + пересчёт `spentCents` — два
   * отдельных `UPDATE`) — при очень высокой одновременной нагрузке на один
   * и тот же креатив возможен небольшой снос (redundant recompute), не
   * потеря данных: `impressionsServed` всё равно инкрементируется атомарно
   * на уровне Postgres, а `spentCents` — идемпотентный пересчёт от него же,
   * не независимый счётчик. Тот же уровень честного упрощения, что и
   * `AdEngineService`'s round-robin-тайбрейк — не скрыто, названо в
   * документации фичи.
   *
   * `campaignId` приходит из тела анонимного `POST .../ads/impression` —
   * untrusted input (см. `RecordAdEventDto`, проверяет только "непустая
   * строка", не "существующая кампания"). Обёрнуто целиком в try/catch —
   * несуществующий/чужой id не должен превращаться в 500 у анонимного
   * посетителя, тот же принцип, что и `AnalyticsService.record`.
   *
   * `context` — где/для кого РЕАЛЬНО произошёл этот конкретный показ,
   * нужен только для `refreshClearingPrice` (второй-цена-аукцион и
   * гео-таргетинг честны ровно настолько, насколько честен пул
   * конкурентов, а он зависит от места/страны, не только от кампании).
   * Все поля — untrusted, как и `campaignId`/`creativeId` — тот же
   * уровень доверия anonymous-эндпоинта, что и всегда: `placement`, не
   * входящий в `campaign.targetPlacements` этой кампании, явно
   * отбрасывается ниже (не тихо принимается как повод пересчитать цену
   * против выдуманного места). */
  async recordImpression(campaignId: string, context: AdEventContext): Promise<void> {
    try {
      const campaign = await this.prisma.adCampaign.update({
        where: { id: campaignId },
        data: { impressionsServed: { increment: 1 } },
      });
      if (campaign.billingModel !== 'cpm') return;
      const priced = await this.refreshClearingPrice(campaign, context);
      const unitPriceCents = priced.effectiveUnitPriceCents ?? priced.bidCents;
      await this.applySpend(priced, Math.floor((priced.impressionsServed * unitPriceCents) / 1000));
    } catch (error) {
      this.logger.warn(
        `Не удалось учесть показ рекламы для кампании ${campaignId}: ${(error as Error).message}`,
      );
    }
  }

  /** См. `recordImpression`'s комментарий — тот же приём, для `cpc`. */
  async recordClick(campaignId: string, context: AdEventContext): Promise<void> {
    try {
      const campaign = await this.prisma.adCampaign.update({
        where: { id: campaignId },
        data: { clicksServed: { increment: 1 } },
      });
      if (campaign.billingModel !== 'cpc') return;
      const priced = await this.refreshClearingPrice(campaign, context);
      const unitPriceCents = priced.effectiveUnitPriceCents ?? priced.bidCents;
      await this.applySpend(priced, priced.clicksServed * unitPriceCents);
    } catch (error) {
      this.logger.warn(
        `Не удалось учесть клик по рекламе для кампании ${campaignId}: ${(error as Error).message}`,
      );
    }
  }

  /** Generalized Second Price (см. `AdCampaign.effectiveUnitPriceCents`'s
   * комментарий в schema.prisma и `lib/clearing-price.ts`) — пересчитывает
   * ТЕКУЩУЮ цену погашения против РЕАЛЬНОГО пула конкурентов на этом месте
   * прямо сейчас (`AdEngineService.getCompetingEffectiveBidsCents`, тот же
   * Redis-кэшированный пул, что использует сама выдача) и сохраняет её —
   * `applySpend` ниже потом честно пересчитывает АГРЕГАТ `spentCents` из
   * НАКОПЛЕННОГО счётчика показов/кликов на эту (обновлённую) цену, та же
   * идемпотентная формула, что была до Vickrey, просто цена в ней теперь не
   * постоянна.
   *
   * ИЗВЕСТНОЕ упрощение (названо, не скрыто): цена обновляется на каждое
   * событие, но применяется РЕТРОАКТИВНО ко ВСЕЙ истории кампании (та же
   * формула `count × price`, не помесячный/поштучный учёт цены на каждый
   * отдельный показ) — если цена погашения выросла/упала между показами,
   * пересчёт задним числом слегка меняет стоимость уже показанных
   * импрессий/кликов, а не только новых. Точный поштучный учёт истории цен
   * потребовал бы либо накопления в долях цента (риск дрейфа округления
   * для `cpm`, где цена за один показ обычно меньше цента), либо отдельной
   * таблицы-леджера на каждое событие — непропорционально этому слайсу;
   * цена конкурентов на практике меняется не на каждый отдельный показ (тот
   * же 60-секундный кэш пула, что и у самой выдачи), так что дрейф в
   * реальности мал.
   *
   * Для `cpc` цена погашения приходит в eCPM (то же измерение, что и
   * `calculateEffectiveCpmCents`) — обратно конвертируется в цену ЗА КЛИК
   * тем же CTR (`calculateCtr`), что использовался для прямого
   * преобразования при ранжировании: симметричная операция, тот же CTR
   * "сейчас", не подобранный отдельно.
   *
   * Никогда не бросает — сбой пересчёта цены (Redis/Postgres недоступны)
   * не должен ронять сам учёт показа/клика: возвращает кампанию как есть
   * (с уже существующим `effectiveUnitPriceCents`, если он был, иначе
   * `recordImpression`/`recordClick` откатятся на `bidCents`). */
  private async refreshClearingPrice(
    campaign: AdCampaign,
    context: AdEventContext,
  ): Promise<AdCampaign> {
    if (!context.placement || !campaign.targetPlacements.includes(context.placement)) {
      return campaign;
    }

    try {
      const poolBidsCents = await this.adEngineService.getCompetingEffectiveBidsCents(
        context.publisherBusinessId,
        context.placement,
        context.visitorCountry,
      );
      const ownEffectiveBidCents = calculateEffectiveCpmCents(campaign);
      const clearingEcpmCents = calculateClearingPriceCents(ownEffectiveBidCents, poolBidsCents);
      const unitPriceCents =
        campaign.billingModel === 'cpm'
          ? clearingEcpmCents
          : Math.round(clearingEcpmCents / (calculateCtr(campaign) * 1000));

      return await this.prisma.adCampaign.update({
        where: { id: campaign.id },
        data: { effectiveUnitPriceCents: unitPriceCents },
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось пересчитать цену погашения аукциона для кампании ${campaign.id}: ${(error as Error).message}`,
      );
      return campaign;
    }
  }

  /** Общий хвост `recordImpression`/`recordClick` — пересчитывает
   * `spentCents` и автоматически ставит кампанию на паузу при исчерпании
   * бюджета (`spentCents >= budgetCents`), реальная, а не декларативная
   * авто-пауза: `AdEngineService` отбирает только `status: 'active'`,
   * поставленная на паузу кампания перестаёт получать показы со следующего
   * же запроса, без отдельного фонового джоба. */
  private async applySpend(campaign: AdCampaign, nextSpentCents: number): Promise<void> {
    if (nextSpentCents === campaign.spentCents) return;
    await this.prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        spentCents: nextSpentCents,
        ...(nextSpentCents >= campaign.budgetCents && campaign.status === 'active'
          ? { status: 'paused' }
          : {}),
      },
    });
  }

  // --- Admin-only (см. AdminAdvertisingController) -----------------------

  async listPendingReview(): Promise<AdCampaignDto[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'pending_review' },
      include: { creatives: true },
      orderBy: { createdAt: 'asc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  /** Уже одобренные кампании — единственное место, откуда админ может дойти
   * до per-creative модерации (`rejectCreative`/`approveCreative` ниже):
   * снять один креатив имеет смысл только у кампании, которая уже реально
   * показывается. */
  async listActive(): Promise<AdCampaignDto[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'active' },
      include: { creatives: true },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  /** `status: 'paused'` — сегодня попадают сюда ТОЛЬКО автоматически, при
   * исчерпании бюджета (см. `applySpend`), ручной паузы админом в этом
   * слайсе нет. Без этого списка исчерпавшая бюджет кампания стала бы
   * невидимой для админа — не в очереди модерации, не среди активных.
   * Read-only здесь (без approve/reject) — "продлить бюджет" теперь
   * реализовано, но как self-service действие РЕКЛАМОДАТЕЛЯ
   * (`AdCampaignsService.requestTopUp`), а не администратора: тот же
   * self-service принцип, что у создания самой кампании (см. класса
   * комментарий) — админ здесь только наблюдает. */
  async listPaused(): Promise<AdCampaignDto[]> {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'paused' },
      include: { creatives: true },
      orderBy: { updatedAt: 'desc' },
    });
    return campaigns.map((campaign) => toAdCampaignDto(campaign));
  }

  async approve(campaignId: string): Promise<AdCampaignDto> {
    const campaign = await this.findAnyCampaign(campaignId);
    if (campaign.paymentStatus !== 'paid') {
      throw new BadRequestException('Кампания ещё не оплачена — одобрение недоступно');
    }
    const updated = await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status: 'active', rejectionReason: null },
      include: { creatives: true },
    });
    return toAdCampaignDto(updated);
  }

  /** Отклонённая кампания никогда не будет показана — деньги за неё
   * рекламодателя нельзя молча оставлять платформе (тот же принцип, что и
   * `OrdersService.refund`, тот же вызов `PaymentProvider.refundPayment`).
   * Возврат — только если реально было чем возвращать (`paymentStatus:
   * 'paid'` и есть `stripePaymentIntentId`); черновик/неоплаченная кампания
   * просто помечается отклонённой без похода в Stripe. */
  async reject(campaignId: string, reason?: string): Promise<AdCampaignDto> {
    const campaign = await this.findAnyCampaign(campaignId);

    if (campaign.paymentStatus === 'paid' && campaign.stripePaymentIntentId) {
      try {
        await this.paymentProvider.refundPayment(campaign.stripePaymentIntentId);
      } catch (error) {
        this.logger.error(
          `Не удалось вернуть оплату за отклонённую кампанию ${campaign.id}: ${(error as Error).message}`,
        );
        throw new BadRequestException(
          'Не удалось вернуть оплату рекламодателю — кампания не отклонена, попробуйте позже',
        );
      }
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'rejected',
        rejectionReason: reason ?? null,
        ...(campaign.paymentStatus === 'paid' ? { paymentStatus: 'refunded' } : {}),
      },
      include: { creatives: true },
    });
    return toAdCampaignDto(updated);
  }

  /** Тонкая модерация ПОВЕРХ модерации кампании (см. `AdCreativeStatus`'s
   * комментарий в schema.prisma) — снимает ОДИН креатив с показа, не трогая
   * `AdCampaign.status` и остальные креативы той же кампании. */
  async rejectCreative(creativeId: string, reason?: string): Promise<AdCreativeDto> {
    const creative = await this.findAnyCreative(creativeId);
    const updated = await this.prisma.adCreative.update({
      where: { id: creative.id },
      data: { status: 'rejected', rejectionReason: reason ?? null },
    });
    return toAdCreativeDto(updated);
  }

  async approveCreative(creativeId: string): Promise<AdCreativeDto> {
    const creative = await this.findAnyCreative(creativeId);
    const updated = await this.prisma.adCreative.update({
      where: { id: creative.id },
      data: { status: 'approved', rejectionReason: null },
    });
    return toAdCreativeDto(updated);
  }

  // --- Admin-only: banned advertisers (см. `AdvertiserBan`'s комментарий) --

  async banAdvertiser(businessId: string, reason?: string): Promise<void> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Бизнес не найден');

    await this.prisma.advertiserBan.upsert({
      where: { businessId },
      create: { businessId, reason: reason ?? null },
      update: { reason: reason ?? null, bannedAt: new Date() },
    });
  }

  async unbanAdvertiser(businessId: string): Promise<void> {
    await this.prisma.advertiserBan.deleteMany({ where: { businessId } });
  }

  async listBannedAdvertisers(): Promise<
    { businessId: string; businessName: string; reason: string | null; bannedAt: string }[]
  > {
    const bans = await this.prisma.advertiserBan.findMany({
      include: { business: { select: { name: true } } },
      orderBy: { bannedAt: 'desc' },
    });
    return bans.map((ban) => ({
      businessId: ban.businessId,
      businessName: ban.business.name,
      reason: ban.reason,
      bannedAt: ban.bannedAt.toISOString(),
    }));
  }

  /** Вызывается из `create`/`submitForReview` — банит именно РЕКЛАМОДАТЕЛЯ
   * (см. `AdvertiserBan`'s комментарий: не трогает роль паблишера того же
   * бизнеса). Сообщение намеренно не раскрывает `reason` вызывающему —
   * причина бана видна только администратору (`listBannedAdvertisers`), не
   * забаненному бизнесу через обычный API. */
  private async assertNotBannedAdvertiser(businessId: string): Promise<void> {
    const ban = await this.prisma.advertiserBan.findUnique({ where: { businessId } });
    if (ban) {
      throw new ForbiddenException(
        'Этому бизнесу запрещено создавать рекламные кампании — обратитесь в поддержку',
      );
    }
  }

  private async findAnyCreative(creativeId: string) {
    const creative = await this.prisma.adCreative.findUnique({ where: { id: creativeId } });
    if (!creative) throw new NotFoundException('Креатив не найден');
    return creative;
  }

  private async findAnyCampaign(campaignId: string): Promise<CampaignWithCreatives> {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id: campaignId },
      include: { creatives: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    return campaign;
  }

  private async findOwnedCampaign(
    businessId: string,
    campaignId: string,
  ): Promise<CampaignWithCreatives> {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, advertiserBusinessId: businessId },
      include: { creatives: true },
    });
    if (!campaign) throw new NotFoundException('Кампания не найдена');
    return campaign;
  }

  /** Публичный (не `private`) — тот же приём, что `ProductsService.
   * assertOwnership`: `AdCampaignsController.uploadImage` вызывает его
   * до записи файла на диск, не дублируя проверку владения. */
  async assertOwnership(businessId: string, ownerId: string): Promise<{ currency: string }> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, currency: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    return { currency: business.currency };
  }
}
