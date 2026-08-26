import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Discount } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { calculateOrderPricing, checkDiscountEligibility } from '@/modules/pricing/pricing';
import type { CreateDiscountDto } from './dto/create-discount.dto';
import type { UpdateDiscountDto } from './dto/update-discount.dto';
import type { CouponPreviewResult, DiscountDto } from './discounts.types';

/** Владелец-CRUD скидок одного бизнеса (Dashboard "Скидки", Pricing Engine
 * Phase 17, см. `PRICING_ARCHITECTURE.md`) — вложен под
 * `/businesses/:businessId/discounts`, тот же принцип, что у
 * `ProductsService`/`ServicesService`. Публичное разрешение купона по коду
 * (`preview`) живёт здесь же, но вызывается из `PublicSitesController`, а не
 * из этого owner-only контроллера — тот же приём разделения владелец/
 * публика, что уже применён у `ProductsService.listPublic`. */
@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, ownerId: string): Promise<DiscountDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const discounts = await this.prisma.discount.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return discounts.map((discount) => this.toDto(discount));
  }

  async create(businessId: string, ownerId: string, dto: CreateDiscountDto): Promise<DiscountDto> {
    await this.assertOwnership(businessId, ownerId);
    this.assertPercentageBound(dto.type, dto.value);
    const code = await this.normalizeAndCheckCode(businessId, dto.code);

    const discount = await this.prisma.discount.create({
      data: {
        businessId,
        name: dto.name,
        code,
        type: dto.type,
        value: dto.value,
        minOrderAmountCents: dto.minOrderAmountCents ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toDto(discount);
  }

  async update(
    businessId: string,
    discountId: string,
    ownerId: string,
    dto: UpdateDiscountDto,
  ): Promise<DiscountDto> {
    await this.assertOwnership(businessId, ownerId);
    const existing = await this.findOwnedDiscount(businessId, discountId);
    // Границу "percentage <= 100" проверяем на РЕЗУЛЬТИРУЮЩЕЙ паре type/value
    // — `dto` может менять только одно из двух полей (например, только
    // `value`, оставляя `type` как есть), поэтому эффективное значение
    // всегда собирается с фолбэком на уже сохранённое.
    this.assertPercentageBound(dto.type ?? existing.type, dto.value ?? existing.value);

    const code =
      dto.code !== undefined
        ? await this.normalizeAndCheckCode(businessId, dto.code ?? undefined, discountId)
        : undefined;

    const discount = await this.prisma.discount.update({
      where: { id: discountId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.minOrderAmountCents !== undefined
          ? { minOrderAmountCents: dto.minOrderAmountCents }
          : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null } : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toDto(discount);
  }

  async remove(businessId: string, discountId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedDiscount(businessId, discountId);
    // Намеренно без FK от Order на Discount (см. Order.discountName/
    // couponCode — снэпшот, не ссылка), поэтому удаление скидки, которую уже
    // использовали прошлые заказы, всегда безопасно (та же логика, что у
    // `OrderItem.productId` при удалении `Product`).
    await this.prisma.discount.delete({ where: { id: discountId } });
  }

  /** Публичное предпросмотр-применение купона (`PublicSitesController.
   * previewCoupon`, см. `PRICING_ARCHITECTURE.md` §5) — НЕ резервирует
   * `usageCount`, вызывает ровно ту же `checkDiscountEligibility`/
   * `calculateOrderPricing`, что и реальное создание заказа
   * (`OrdersService.createFromCart`), так что показанная здесь скидка не
   * может разойтись с тем, что реально спишется при оформлении. */
  async preview(
    businessId: string,
    code: string,
    subtotalCents: number,
  ): Promise<CouponPreviewResult> {
    const discount = await this.findByCode(businessId, code);
    if (!discount) return { valid: false, reason: 'not_found' };

    const rejection = checkDiscountEligibility(discount, subtotalCents);
    if (rejection) return { valid: false, reason: rejection };

    const { discountCents } = calculateOrderPricing({
      items: [{ priceCents: subtotalCents, quantity: 1 }],
      taxRateBps: 0,
      taxMode: 'none',
      discount: { type: discount.type, value: discount.value },
    });

    return {
      valid: true,
      name: discount.name,
      type: discount.type,
      value: discount.value,
      discountCents,
    };
  }

  /** Разрешает код скидки для ЭТОГО бизнеса — используется и превью-
   * эндпоинтом купона, и `OrdersService.createFromCart` (реальное
   * применение), оба обращаются к одному и тому же методу, чтобы не
   * дублировать сравнение регистра/поиск по businessId+code в двух местах. */
  async findByCode(businessId: string, code: string): Promise<Discount | null> {
    return this.prisma.discount.findUnique({
      where: { businessId_code: { businessId, code: code.trim().toUpperCase() } },
    });
  }

  /** Кандидаты на АВТОМАТИЧЕСКУЮ скидку (`code: null`, см. комментарий
   * модели `Discount` в schema.prisma) для этого бизнеса — вызывается
   * `OrdersService.createFromCart`, когда покупатель НЕ ввёл промокод.
   * Дальнейшая фильтрация по датам/лимиту/минимальной сумме и выбор лучшей
   * среди нескольких подходящих — на стороне вызывающего
   * (`checkDiscountEligibility`/`calculateOrderPricing`, см.
   * `PRICING_ARCHITECTURE.md` §7 "Два автоматических скидки одновременно
   * подходят" — детерминированный tie-break: побеждает та, что даёт
   * бОльшую `discountCents`), не здесь — этот метод только сужает выборку
   * до активных записей без кода. */
  async findActiveAutomaticDiscounts(businessId: string): Promise<Discount[]> {
    return this.prisma.discount.findMany({
      where: { businessId, code: null, isActive: true },
    });
  }

  /** DTO проверяет только абсолютный потолок `value` (`@Max(1_000_000_000)`,
   * см. `CreateDiscountDto`) — годится для `fixed` (минимальные единицы
   * валюты), но НЕ для `percentage`, у которого осмысленный диапазон 1-100:
   * без этой проверки скидка "500%" молча прошла бы валидацию и просто
   * схлопывалась бы в 100%-скидку на этапе расчёта (`calculateOrderPricing`
   * клэмпит `discountCents` до `subtotalCents`) — сама запись в БД и её
   * показ в Dashboard остались бы вводящими в заблуждение. Проверка здесь,
   * а не в DTO класс-валидатором: зависит от ДРУГОГО поля того же DTO
   * (`type`), тот же принцип, что и у остальных межполевых бизнес-правил
   * этого сервиса (уникальность кода, владение). */
  private assertPercentageBound(type: 'percentage' | 'fixed', value: number): void {
    if (type === 'percentage' && value > 100) {
      throw new BadRequestException('Процентная скидка не может превышать 100%');
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

  private async findOwnedDiscount(businessId: string, discountId: string): Promise<Discount> {
    const discount = await this.prisma.discount.findUnique({ where: { id: discountId } });
    if (!discount || discount.businessId !== businessId) {
      throw new NotFoundException('Скидка не найдена');
    }
    return discount;
  }

  private async normalizeAndCheckCode(
    businessId: string,
    code: string | undefined,
    excludeId?: string,
  ): Promise<string | null> {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    const existing = await this.prisma.discount.findUnique({
      where: { businessId_code: { businessId, code: normalized } },
      select: { id: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Скидка с таким кодом уже существует');
    }
    return normalized;
  }

  private toDto(discount: Discount): DiscountDto {
    return {
      id: discount.id,
      businessId: discount.businessId,
      name: discount.name,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      minOrderAmountCents: discount.minOrderAmountCents,
      startsAt: discount.startsAt ? discount.startsAt.toISOString() : null,
      endsAt: discount.endsAt ? discount.endsAt.toISOString() : null,
      usageLimit: discount.usageLimit,
      usageCount: discount.usageCount,
      isActive: discount.isActive,
      createdAt: discount.createdAt.toISOString(),
      updatedAt: discount.updatedAt.toISOString(),
    };
  }
}
