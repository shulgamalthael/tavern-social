import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { AvailabilityQueryDto } from '@/modules/appointments/dto/availability-query.dto';
import { CreateAppointmentDto } from '@/modules/appointments/dto/create-appointment.dto';
import type { AppointmentDto } from '@/modules/appointments/appointments.types';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { BlogPostsService } from '@/modules/blog-posts/blog-posts.service';
import type { PublicBlogPostDto } from '@/modules/blog-posts/blog-posts.types';
import { CouponPreviewDto } from '@/modules/discounts/dto/coupon-preview.dto';
import type { CouponPreviewResult } from '@/modules/discounts/discounts.types';
import { DiscountsService } from '@/modules/discounts/discounts.service';
import { DomainResolverService } from '@/modules/domains/domain-resolver.service';
import type { ResolvedSiteDto } from '@/modules/domains/domains.types';
import { CreateFormSubmissionDto } from '@/modules/form-submissions/dto/create-form-submission.dto';
import { FormSubmissionsService } from '@/modules/form-submissions/form-submissions.service';
import { CreateOrderDto } from '@/modules/orders/dto/create-order.dto';
import type { OrderDto } from '@/modules/orders/orders.types';
import { OrdersService } from '@/modules/orders/orders.service';
import { ProductsService } from '@/modules/products/products.service';
import type { PublicProductDto } from '@/modules/products/products.types';
import { RulesService } from '@/modules/rules/rules.service';
import { ServicesService } from '@/modules/services/services.service';
import type { PublicServiceDto } from '@/modules/services/services.types';
import { Web3Service } from '@/modules/web3/web3.service';
import type { WalletInfoDto } from '@/modules/web3/web3.types';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsitePublicDto } from '@/modules/websites/websites.types';

/**
 * Единственный по-настоящему анонимный контроллер сайтов — без
 * `SessionAuthGuard` (см. корневой план задачи, раздел «MVP Domain Flow»):
 * посетитель `coffee.com` не обязан иметь аккаунт в Таверне вообще, в
 * отличие от `/business/[id]` внутри приложения (там — владелец/участник
 * Таверны, см. `WebsitesController.getPublic`, `@UseGuards(SessionAuthGuard)`
 * на уровне класса). Два раздельных пути к одному и тому же
 * `WebsitesService.getPublic` — сознательно: не ослабляем защищённый
 * маршрут ради этого, а добавляем отдельный, честно публичный.
 *
 * `resolve` вызывает Next.js middleware на edge (см. `frontend/src/proxy.ts`)
 * на каждый запрос к домену, кроме собственного домена приложения — только
 * hostname → businessId, без содержимого сайта (маленький и быстрый ответ).
 * `getPublicSite` отдаёт уже сами данные — вызывается со страницы `/site/
 * [businessId]`, на которую middleware переписывает запрос.
 */
@Controller('sites')
export class PublicSitesController {
  private readonly logger = new Logger(PublicSitesController.name);

  constructor(
    private readonly domainResolver: DomainResolverService,
    private readonly websitesService: WebsitesService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly servicesService: ServicesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly blogPostsService: BlogPostsService,
    private readonly formSubmissionsService: FormSubmissionsService,
    private readonly analyticsService: AnalyticsService,
    private readonly discountsService: DiscountsService,
    private readonly rulesService: RulesService,
    private readonly web3Service: Web3Service,
  ) {}

  @Get('resolve')
  async resolve(@Query('hostname') hostname?: string): Promise<ResolvedSiteDto> {
    if (!hostname) throw new BadRequestException('Не передан hostname');

    const resolved = await this.domainResolver.resolve(hostname);
    if (!resolved) throw new NotFoundException('Сайт с таким адресом не найден');

    return { businessId: resolved.businessId };
  }

  /** Единственное место в проекте, где записывается `'page_view'` (см.
   * `AnalyticsService`/комментарий модели `AnalyticsEvent`) — намеренно
   * именно здесь, а не внутри `WebsitesService.getPublic`: тот же метод
   * сервиса вызывает и `WebsitesController.getPublic` (`/businesses/
   * :businessId/website/public`), внутренний preview владельца изнутри
   * Таверны — считать его "просмотром сайта" задвоило бы счётчик каждым
   * открытием собственного сайта владельцем, поэтому запись живёт в
   * контроллере, у по-настоящему анонимного входа, а не в общей логике. */
  @Get(':businessId')
  async getPublicSite(@Param('businessId') businessId: string): Promise<WebsitePublicDto> {
    const site = await this.websitesService.getPublic(businessId);
    await this.analyticsService.record(businessId, 'page_view');
    return site;
  }

  /** Витрина каталога для блока `productgrid` (см. `entities/website/blocks/
   * commerce`) — по-настоящему анонимно, без проверки владения (тот же
   * принцип, что и у `getPublicSite` выше): только активные товары, ничего
   * из владельческого `ProductDto` сверх того, что видно на витрине (см.
   * `ProductsService.listPublic`/`PublicProductDto`). Отдельный путь, а не
   * параметр у `getPublicSite`, потому что виджет каталога дозагружает
   * товары независимо от остального документа сайта (см. компонент
   * `ProductGridRenderer` — свой `useAsyncData`, не общий с `PublicSiteWidget`). */
  @Get(':businessId/products')
  getPublicProducts(@Param('businessId') businessId: string): Promise<PublicProductDto[]> {
    return this.productsService.listPublic(businessId);
  }

  /** Оформление заказа с анонимной витрины (см. `entities/cart`/`Checkout`
   * блок на frontend) — без сессии Таверны, тот же принцип, что и у
   * остального этого контроллера. Цена и название каждой позиции
   * пересчитываются на backend из актуального `Product` (см.
   * `OrdersService.createFromCart`), не берутся из тела запроса — иначе
   * анонимный клиент мог бы прислать любую цену. `@Throttle` — один из
   * немногих ЗАПИСЫВАЮЩИХ анонимных эндпоинтов во всём проекте (создаёт
   * реальную запись в БД без какой-либо аутентификации, см. также
   * `createAppointment`/`createFormSubmission` ниже), поэтому лимит
   * заметно строже, чем у остальных публичных `GET` здесь.
   *
   * `rulesService.evaluate('order_completed', ...)` — Business Logic Engine
   * v1 (AI_PLATFORM_ROADMAP.md §2.5/AI-5) — вызывается ЗДЕСЬ, ПОСЛЕ того как
   * заказ уже реально создан и закоммичен, тем же "Controller решает,
   * Service не знает" принципом, что и у Socket.IO-эмиссий в проекте (см.
   * `AGENTS.md` backend). Обёрнут в try/catch на этом уровне ДОПОЛНИТЕЛЬНО
   * к тому, что `RulesService.evaluate` уже сама не бросает исключения из-за
   * упавшего ДЕЙСТВИЯ одного правила (см. её комментарий) — эта обёртка
   * защищает от любой другой неожиданной ошибки движка, чтобы уже созданный
   * и оплаченный (в будущем) заказ никогда не превращался в 500 для
   * покупателя из-за проблемы в автоматизации, которая покупателя вообще не
   * касается. */
  @Post(':businessId/orders')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createOrder(
    @Param('businessId') businessId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderDto> {
    const order = await this.ordersService.createFromCart(businessId, dto);

    try {
      await this.rulesService.evaluate('order_completed', businessId, {
        totalCents: order.totalCents,
        subtotalCents: order.subtotalCents,
        currency: order.currency,
        status: order.status,
        customerEmail: order.customerEmail,
      });
    } catch (error) {
      this.logger.warn(
        `Business Logic Engine упал на order_completed для заказа ${order.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return order;
  }

  /** Предпросмотр промокода (Pricing Engine, Phase 17, см.
   * `PRICING_ARCHITECTURE.md` §5) — вызывается корзиной ДО оформления
   * заказа, чтобы показать "Применено ✓ / Промокод не найден" сразу, не
   * дожидаясь сабмита всей формы. НЕ резервирует использование и НЕ
   * является источником истины для реального списания — оно пересчитывается
   * заново, независимо, в `createOrder` ниже. Тот же более строгий
   * `@Throttle`, что и у остальных анонимных ЗАПИСЫВАЮЩИХ... — на самом деле
   * это чтение, но обращается к БД по произвольному введённому коду, тот же
   * риск перебора кодов, что и у любого анонимного поиска по секрету. */
  @Post(':businessId/coupons/preview')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  previewCoupon(
    @Param('businessId') businessId: string,
    @Body() dto: CouponPreviewDto,
  ): Promise<CouponPreviewResult> {
    return this.discountsService.preview(businessId, dto.code, dto.subtotalCents);
  }

  /** Витрина услуг для блока `servicegrid` (см. `entities/website/blocks/
   * booking`) — тот же принцип, что и `getPublicProducts`. */
  @Get(':businessId/services')
  getPublicServices(@Param('businessId') businessId: string): Promise<PublicServiceDto[]> {
    return this.servicesService.listPublic(businessId);
  }

  /** Свободные слоты услуги на дату (Booking, ROADMAP.md §8 Phase 6
   * continued) — `BookingModal.tsx` вызывает это при выборе даты, чтобы
   * показать список слотов вместо произвольного ввода времени; `?date=`
   * распарсен и провалидирован форматом в `AvailabilityQueryDto`, дальше —
   * `AppointmentsService.getAvailability`/`lib/availability.ts`. Обычный
   * `@Get`, не более строгий `@Throttle`, что у анонимных `Post` выше —
   * это чтение, не запись, тот же принцип, что и `getPublicProducts`. */
  @Get(':businessId/services/:serviceId/availability')
  getAvailability(
    @Param('businessId') businessId: string,
    @Param('serviceId') serviceId: string,
    @Query() query: AvailabilityQueryDto,
  ): Promise<string[]> {
    // Локальный конструктор `Date`, не `new Date("YYYY-MM-DD")` — тот парсит
    // голую дату как UTC-полночь, а не полночь по времени сервера, и
    // `getDate()`/`getDay()` ниже по цепочке (`lib/availability.ts`) читают
    // именно локальные компоненты — на сервере в часовом поясе позади UTC
    // это был бы сдвиг календарного дня на минус один.
    const [year, month, day] = query.date.split('-').map(Number);
    return this.appointmentsService.getAvailability(
      businessId,
      serviceId,
      new Date(year, month - 1, day),
    );
  }

  /** Заявка на запись с анонимной витрины — тот же принцип, что и
   * `createOrder`: цена/название/длительность пересчитываются на backend из
   * актуальной `Service`, не берутся из тела запроса. Тот же более строгий
   * `@Throttle`, что и у заказов. `rulesService.evaluate('appointment_booked',
   * ...)` — тот же принцип и та же try/catch-обёртка, что у `order_completed`
   * в `createOrder` выше (второй bounded-слайс AI-5, см. её комментарий там
   * и `RuleTrigger`'s комментарий в схеме). */
  @Post(':businessId/appointments')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createAppointment(
    @Param('businessId') businessId: string,
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentDto> {
    const appointment = await this.appointmentsService.createFromRequest(businessId, dto);

    try {
      await this.rulesService.evaluate('appointment_booked', businessId, {
        priceCents: appointment.priceCents,
        durationMinutes: appointment.durationMinutes,
        currency: appointment.currency,
        status: appointment.status,
        serviceName: appointment.serviceName,
        customerEmail: appointment.customerEmail,
      });
    } catch (error) {
      this.logger.warn(
        `Business Logic Engine упал на appointment_booked для записи ${appointment.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return appointment;
  }

  /** Отправка формы (`contactform`/`newsletterform`/`simpleform`, см.
   * `entities/website/blocks/forms` на frontend) с анонимной витрины —
   * единственный анонимный ЗАПИСЫВАЮЩИЙ путь, у которого нет капабилити:
   * формы доступны любому бизнесу без включения `Business.capabilities`
   * (см. комментарий модели `FormSubmission` в schema.prisma). Тот же
   * более строгий `@Throttle`, что и у заказов/записей — третий и
   * последний анонимный ЗАПИСЫВАЮЩИЙ эндпоинт во всём проекте. Возвращает
   * `204` без тела — форме на frontend нечего показать в ответе, только
   * факт успеха/ошибки (см. `FormBlock.tsx`). `rulesService.evaluate(
   * 'form_submitted', ...)` — тот же принцип, что у `order_completed`/
   * `appointment_booked` выше, но пропускается целиком, если сервис вернул
   * `null` (honeypot — см. `FormSubmissionsService.createFromRequest`'s
   * комментарий: фиктивная заявка бота не должна запускать автоматизацию
   * владельца). */
  @Post(':businessId/form-submissions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async createFormSubmission(
    @Param('businessId') businessId: string,
    @Body() dto: CreateFormSubmissionDto,
  ): Promise<void> {
    const submission = await this.formSubmissionsService.createFromRequest(businessId, dto);
    if (!submission) return;

    try {
      await this.rulesService.evaluate('form_submitted', businessId, {
        formType: submission.formType,
        formLabel: submission.formLabel,
      });
    } catch (error) {
      this.logger.warn(
        `Business Logic Engine упал на form_submitted для заявки ${submission.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Витрина постов блога для блока `bloggrid` (см. `entities/website/
   * blocks/content`) и списочной страницы `/site/[businessId]/blog` на
   * frontend — тот же принцип, что и `getPublicProducts`/`getPublicServices`.
   * Никакого анонимного эндпоинта на запись для блога нет вообще — посты
   * пишет только владелец (см. комментарий `BlogPostsService`). */
  @Get(':businessId/blog-posts')
  getPublicBlogPosts(@Param('businessId') businessId: string): Promise<PublicBlogPostDto[]> {
    return this.blogPostsService.listPublic(businessId);
  }

  /** Один пост по slug — для страницы чтения `/site/[businessId]/blog/
   * [postSlug]`. 404, если поста с таким slug нет ИЛИ он не опубликован —
   * оба случая для анонимного посетителя должны выглядеть одинаково (см.
   * `BlogPostsService.getPublicBySlug`, возвращает `null` для обоих). */
  @Get(':businessId/blog-posts/:slug')
  async getPublicBlogPostBySlug(
    @Param('businessId') businessId: string,
    @Param('slug') slug: string,
  ): Promise<PublicBlogPostDto> {
    const post = await this.blogPostsService.getPublicBySlug(businessId, slug);
    if (!post) throw new NotFoundException('Пост не найден');
    return post;
  }

  /** Витрина баланса/NFT для блока `web3wallet` (AI_PLATFORM_ROADMAP.md §26,
   * AI-13) — тот же принцип, что и `getPublicProducts`/`getPublicServices`:
   * по-настоящему анонимно, никакой owner-проверки (`Web3Service.
   * getWalletInfoPublic`, не `getWalletInfo` — та требует владельца). API-
   * ключ бизнеса используется только внутри `Web3Service`, наружу никогда не
   * уходит. Более строгий `@Throttle`, чем у остальных анонимных `GET` здесь
   * (`getPublicProducts`/`getPublicServices` читают из своей БД — дёшево;
   * этот эндпоинт на каждый вызов идёт во внешний Alchemy API реальным
   * запросом, оплаченным лимитом КОНКРЕТНОГО бизнеса, — без лимита анонимный
   * трафик на популярную страницу мог бы быстро исчерпать чужую бесплатную
   * квоту). Кеширования пока нет — известный, не скрытый пробел на будущее
   * (см. AI_PLATFORM_ROADMAP.md §26). */
  @Get(':businessId/web3/wallet')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  getPublicWalletInfo(@Param('businessId') businessId: string): Promise<WalletInfoDto> {
    return this.web3Service.getWalletInfoPublic(businessId);
  }
}
