import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Order, OrderItem } from '@prisma/client';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { DiscountsService } from '@/modules/discounts/discounts.service';
import {
  calculateOrderPricing,
  checkDiscountEligibility,
  type DiscountEligibilityReason,
} from '@/modules/pricing/pricing';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import {
  PaymentAmountTooLowError,
  type PaymentUnavailableReason,
} from '@/modules/payments/payments.types';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { OrderStatus } from './orders.types';
import type { OrderDto } from './orders.types';

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Заявки на заказ с анонимной витрины (см. `PublicSitesController.
 * createOrder`) — владелец-CRUD (`list`/`updateStatus`) вложен под
 * `/businesses/:businessId/orders`, тот же принцип, что у `ProductsService`.
 * Оплата (см. `PaymentProvider`) — опциональная надстройка поверх этой же
 * записи `Order`: если Stripe не настроен, заказ остаётся честной заявкой
 * без оплаты (тот же MVP-путь, что был единственным до появления Stripe, см.
 * ROADMAP.md §8 Phase 5/6), если настроен — к заказу дополнительно
 * привязывается `PaymentIntent`.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProvider,
    private readonly analyticsService: AnalyticsService,
    private readonly discountsService: DiscountsService,
  ) {}

  /**
   * Единственный путь создания заказа — цена и название КАЖДОЙ позиции
   * берутся из текущего `Product` на backend, никогда из тела запроса (см.
   * комментарий `CreateOrderItemDto`): анонимный клиент мог бы иначе
   * прислать любую цену на любой товар. Товар ищется СРЕДИ ТОВАРОВ ЭТОГО ЖЕ
   * бизнеса (`businessId` в `where`) — без этого фильтра можно было бы
   * подсунуть `productId` чужого бизнеса и получить его цену/название в
   * заказе не того продавца. Неактивный/удалённый/чужой товар — повод
   * отклонить ВЕСЬ заказ (400), не тихо выкинуть эту позицию: покупатель
   * иначе увидел бы «оформлено» для заказа, который реально пришёл владельцу
   * не полностью.
   */
  async createFromCart(businessId: string, dto: CreateOrderDto): Promise<OrderDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, currency: true, taxRateBps: true, taxMode: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId, isActive: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    // Считаем суммарное количество на товар, а не проверяем построчно —
    // если один и тот же товар встретился в `items` дважды отдельными
    // строками, построчная проверка сверяла бы КАЖДУЮ строку с одним и тем
    // же исходным `product.stock`, не учитывая уже «занятое» другой строкой
    // количество, и могла бы пропустить перепродажу остатка.
    const totalQuantityByProduct = new Map<string, number>();
    for (const item of dto.items) {
      totalQuantityByProduct.set(
        item.productId,
        (totalQuantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    for (const [productId, totalQuantity] of totalQuantityByProduct) {
      const product = productById.get(productId);
      if (!product) {
        throw new BadRequestException('Один из товаров в заказе больше недоступен');
      }
      if (product.stock !== null && totalQuantity > product.stock) {
        throw new BadRequestException(`Недостаточно «${product.name}» на складе`);
      }
    }

    const pricingItems = dto.items.map((item) => ({
      priceCents: productById.get(item.productId)!.priceCents,
      quantity: item.quantity,
    }));
    const subtotalCents = pricingItems.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0,
    );

    // Промокод пересчитывается заново здесь, независимо от превью-эндпоинта
    // (`PublicSitesController.previewCoupon`) — см. `PRICING_ARCHITECTURE.md`
    // §5: клиент мог не вызывать превью вообще, или условия скидки могли
    // измениться (истёк срок/исчерпан лимит) между превью и этим моментом.
    // Невалидный код на этом этапе — повод отклонить ВЕСЬ заказ (400), тот
    // же принцип, что и у недоступного товара выше — покупатель, введя код,
    // должен знать, что он не сработал, а не молча заплатить без скидки.
    //
    // Явный код ПОБЕЖДАЕТ любую автоматическую скидку (см.
    // `PRICING_ARCHITECTURE.md` §7 "Explicit coupon code + automatic
    // discount") — покупатель, введя код, ожидает именно это предложение,
    // не неожиданную комбинацию. Автоматическая скидка ищется, только если
    // код не введён вообще.
    let discount = dto.couponCode
      ? await this.discountsService.findByCode(businessId, dto.couponCode)
      : null;
    if (dto.couponCode && !discount) {
      throw new BadRequestException('Промокод не найден');
    }
    if (discount) {
      const rejection = checkDiscountEligibility(discount, subtotalCents);
      if (rejection) {
        throw new BadRequestException(this.describeDiscountRejection(rejection));
      }
    } else {
      discount = await this.resolveBestAutomaticDiscount(businessId, subtotalCents);
    }

    const pricing = calculateOrderPricing({
      items: pricingItems,
      taxRateBps: business.taxRateBps,
      taxMode: business.taxMode,
      discount: discount ? { type: discount.type, value: discount.value } : undefined,
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          businessId,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail ?? null,
          customerPhone: dto.customerPhone ?? null,
          customerNote: dto.customerNote ?? '',
          subtotalCents: pricing.subtotalCents,
          discountCents: pricing.discountCents,
          discountName: discount?.name ?? null,
          couponCode: discount?.code ?? null,
          taxCents: pricing.taxCents,
          totalCents: pricing.totalCents,
          // Снэпшот валюты БИЗНЕСА (Currency System, ROADMAP.md §8), не
          // случайно первого товара из `products` — `Product` больше не
          // хранит свою `currency` вообще (см. `ProductsService`), и даже
          // когда хранил, порядок `products` не гарантированно совпадал с
          // порядком корзины.
          currency: business.currency,
          items: {
            create: dto.items.map((item) => {
              const product = productById.get(item.productId)!;
              return {
                productId: product.id,
                name: product.name,
                priceCents: product.priceCents,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Тот же атомарный `updateMany`-с-условием паттерн, что и у
      // `Product.stock` ниже — если лимит использований исчерпался между
      // проверкой `checkDiscountEligibility` выше и этим моментом (гонка
      // двух покупателей на последнее использование), вся транзакция
      // откатится вместо того, чтобы дать скидку сверх лимита.
      if (discount) {
        const { count } = await tx.discount.updateMany({
          where: {
            id: discount.id,
            OR: [{ usageLimit: null }, { usageCount: { lt: discount.usageLimit ?? 0 } }],
          },
          data: { usageCount: { increment: 1 } },
        });
        if (count === 0) {
          throw new BadRequestException('Промокод больше недоступен');
        }
      }

      // `updateMany` с условием `stock: { gte: totalQuantity }` в `where`,
      // не read-then-write через ранее прочитанный `product.stock` — так
      // уменьшение остатка и проверка «хватает ли ещё» происходят одним
      // атомарным запросом к БД. Если между первичным чтением товаров выше
      // и этим моментом остаток успел измениться (два покупателя оформляют
      // заказ на последний экземпляр одновременно), `count` окажется 0, и
      // вся транзакция откатится — вместо того, чтобы уйти в минус.
      for (const [productId, totalQuantity] of totalQuantityByProduct) {
        const product = productById.get(productId)!;
        if (product.stock !== null) {
          const { count } = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: totalQuantity } },
            data: { stock: { decrement: totalQuantity } },
          });
          if (count === 0) {
            throw new BadRequestException(`Недостаточно «${product.name}» на складе`);
          }
        }
      }

      return created;
    });

    await this.analyticsService.record(businessId, 'order_created', { orderId: order.id });

    // Отдельно от транзакции выше (см. её собственную границу — заказ и
    // списание остатка уже зафиксированы): вызов внешнего API (Stripe)
    // внутри Prisma-транзакции держал бы блокировки в БД на всё время
    // сетевого запроса. Если Stripe недоступен/вернул ошибку — заказ
    // остаётся созданным как честная заявка БЕЗ оплаты (см. `PaymentStatus.
    // unpaid`), а не откатывается целиком: временная проблема с оплатой не
    // должна убивать уже принятый заказ, который продавец всё ещё может
    // обработать вручную. `paymentUnavailableReason` — раньше это молча
    // приводило к заказу без `clientSecret`, неотличимо для frontend от
    // «оплата этому бизнесу не нужна», даже когда Stripe настроен, но упал
    // по конкретной причине (например, сумма заказа меньше минимума
    // Stripe — реальный, не гипотетический случай для дешёвых позиций).
    if (!this.paymentProvider.isConfigured()) {
      return { ...this.toDto(order), paymentUnavailableReason: 'not_configured' };
    }

    try {
      const { paymentIntentId, clientSecret } = await this.paymentProvider.createPaymentIntent({
        amountCents: order.totalCents,
        currency: order.currency,
        metadata: { orderId: order.id, businessId },
      });
      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntentId: paymentIntentId },
      });
      return { ...this.toDto(order), clientSecret };
    } catch (error) {
      const reason: PaymentUnavailableReason =
        error instanceof PaymentAmountTooLowError ? 'amount_too_low' : 'provider_error';
      this.logger.error(
        `Не удалось создать PaymentIntent для заказа ${order.id}: ${(error as Error).message}`,
      );
      return { ...this.toDto(order), paymentUnavailableReason: reason };
    }
  }

  /** Вызывается только вебхуком Stripe (см. `StripeWebhookController`) — не
   * владелец-CRUD-путь, поэтому не проверяет `ownerId`. `payment_intent.
   * succeeded` — единственное событие, которое переводит заказ в `paid`;
   * `payment_intent.payment_failed` намеренно не меняет `paymentStatus`
   * (заказ остаётся `unpaid`, продавец видит это в Dashboard и решает сам —
   * повторной попытки оплаты в этом инкременте ещё нет, см. ROADMAP.md). */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!order) {
      this.logger.warn(`Вебхук Stripe для неизвестного PaymentIntent ${paymentIntentId}`);
      return;
    }
    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'paid' },
    });
  }

  async list(businessId: string, ownerId: string): Promise<OrderDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const orders = await this.prisma.order.findMany({
      where: { businessId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.toDto(order));
  }

  async updateStatus(
    businessId: string,
    orderId: string,
    ownerId: string,
    status: OrderStatus,
  ): Promise<OrderDto> {
    await this.assertOwnership(businessId, ownerId);
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing || existing.businessId !== businessId) {
      throw new NotFoundException('Заказ не найден');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { items: true },
    });
    return this.toDto(updated);
  }

  /** Среди активных автоматических скидок бизнеса (`code: null`) выбирает
   * подходящую с НАИБОЛЬШЕЙ реальной суммой скидки — детерминированный
   * tie-break для случая "несколько автоматических скидок одновременно
   * подходят" (см. `PRICING_ARCHITECTURE.md` §7). `null`, если ни одна не
   * подходит (нет автоматических скидок вообще — самый частый случай). */
  private async resolveBestAutomaticDiscount(
    businessId: string,
    subtotalCents: number,
  ): ReturnType<DiscountsService['findByCode']> {
    const candidates = await this.discountsService.findActiveAutomaticDiscounts(businessId);
    let best: Awaited<ReturnType<DiscountsService['findByCode']>> = null;
    let bestDiscountCents = -1;

    for (const candidate of candidates) {
      if (checkDiscountEligibility(candidate, subtotalCents)) continue;
      const { discountCents } = calculateOrderPricing({
        items: [{ priceCents: subtotalCents, quantity: 1 }],
        taxRateBps: 0,
        taxMode: 'none',
        discount: { type: candidate.type, value: candidate.value },
      });
      if (discountCents > bestDiscountCents) {
        best = candidate;
        bestDiscountCents = discountCents;
      }
    }

    return best;
  }

  private describeDiscountRejection(reason: DiscountEligibilityReason): string {
    switch (reason) {
      case 'inactive':
        return 'Промокод отключён';
      case 'not_started':
        return 'Промокод ещё не действует';
      case 'expired':
        return 'Срок действия промокода истёк';
      case 'usage_limit_reached':
        return 'Промокод больше недоступен';
      case 'min_order_not_met':
        return 'Сумма заказа меньше минимальной для этого промокода';
    }
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private toDto(order: OrderWithItems): OrderDto {
    return {
      id: order.id,
      businessId: order.businessId,
      status: order.status,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerNote: order.customerNote,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      discountName: order.discountName,
      couponCode: order.couponCode,
      taxCents: order.taxCents,
      totalCents: order.totalCents,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        priceCents: item.priceCents,
        quantity: item.quantity,
      })),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
