import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Appointment } from '@prisma/client';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { WorkingHours } from '@/modules/businesses/lib/working-hours';
import { PaymentProvider } from '@/modules/payments/payment-provider';
import {
  PaymentAmountTooLowError,
  type PaymentUnavailableReason,
} from '@/modules/payments/payments.types';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { AppointmentDto, AppointmentStatus } from './appointments.types';
import {
  computeAvailableSlots,
  findConflict,
  isWithinWorkingHours,
  type ExistingAppointment,
} from './lib/availability';

/** Записи вокруг календарной даты, у которых МОГ БЫ быть конфликт с новой —
 * с запасом в сутки в обе стороны, а не строго `[dayStart, dayEnd)`: услуга
 * длиной несколько часов, начавшаяся вечером накануне, теоретически может
 * закончиться уже в пределах интересующего дня (см. `findConflict` в
 * `lib/availability.ts` — сама проверка пересечения точная, этот запрос
 * только достаточно широкий фильтр по `startsAt`, чтобы её не пропустить). */
const CONFLICT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Заявки на запись с анонимной витрины (см. `PublicSitesController.
 * createAppointment`) — без полноценного движка доступности с `Employee`
 * (см. комментарий модели `Appointment` в schema.prisma), но с реальной
 * проверкой часов работы бизнеса и двойного бронирования (ROADMAP.md §8
 * Phase 6 continued, `lib/availability.ts`): клиент присылает желаемое
 * время, backend отклоняет его, если оно вне часов работы ИЛИ пересекается с
 * уже существующей записью — владелец по-прежнему подтверждает вручную
 * (никакого автоматического движения денег здесь нет), но больше не может
 * получить два запроса на одно и то же время, о которых узнает только по
 * счастливой случайности. Владелец-CRUD (`list`/`updateStatus`) вложен под
 * `/businesses/:businessId/appointments`, тот же принцип, что у
 * `OrdersService`.
 */
@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  /** Название/цена/длительность подставляются из ТЕКУЩЕГО `Service` на
   * backend, не из тела запроса (тот же принцип, что и у `OrdersService.
   * createFromCart` — анонимный клиент не должен диктовать цену). Услуга
   * ищется СРЕДИ УСЛУГ ЭТОГО ЖЕ бизнеса — без этого можно было бы подсунуть
   * `serviceId` чужого бизнеса (тот же cross-tenant-injection риск, что и у
   * заказов). */
  async createFromRequest(businessId: string, dto: CreateAppointmentDto): Promise<AppointmentDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, currency: true, workingHours: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId, isActive: true },
    });
    if (!service) {
      throw new BadRequestException('Эта услуга больше недоступна');
    }

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('Выберите время в будущем');
    }

    const workingHours = (business.workingHours as unknown as WorkingHours | null) ?? null;
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    if (!isWithinWorkingHours(workingHours, startsAt, endsAt)) {
      throw new BadRequestException('Это время вне часов работы');
    }

    const existing = await this.findAppointmentsAround(businessId, startsAt);
    if (findConflict(startsAt, service.durationMinutes, existing)) {
      throw new BadRequestException('Это время уже занято — выберите другое');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        businessId,
        serviceId: service.id,
        serviceName: service.name,
        priceCents: service.priceCents,
        // Снэпшот валюты БИЗНЕСА (Currency System, ROADMAP.md §8) — `Service`
        // больше не хранит свою `currency` (см. `ServicesService`).
        currency: business.currency,
        durationMinutes: service.durationMinutes,
        startsAt,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerNote: dto.customerNote ?? '',
      },
    });
    await this.analyticsService.record(businessId, 'appointment_created', {
      appointmentId: appointment.id,
    });

    // Полная цена услуги, без депозита — тот же "нет частичной оплаты в этом
    // инкременте" принцип, что и у Commerce (`OrdersService.createFromCart`
    // тоже никогда не берёт предоплату отдельно от полной суммы). Вызывается
    // ПОСЛЕ создания записи, не внутри одной транзакции с ней — по той же
    // причине, что и у заказов: внешний HTTP-вызов не должен держать
    // блокировку в БД, и временный сбой Stripe не должен откатывать уже
    // принятую заявку на запись.
    if (!this.paymentProvider.isConfigured()) {
      return { ...this.toDto(appointment), paymentUnavailableReason: 'not_configured' };
    }

    try {
      const { paymentIntentId, clientSecret } = await this.paymentProvider.createPaymentIntent({
        amountCents: appointment.priceCents,
        currency: appointment.currency,
        metadata: { appointmentId: appointment.id, businessId },
      });
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { stripePaymentIntentId: paymentIntentId },
      });
      return { ...this.toDto(appointment), clientSecret };
    } catch (error) {
      const reason: PaymentUnavailableReason =
        error instanceof PaymentAmountTooLowError ? 'amount_too_low' : 'provider_error';
      this.logger.error(
        `Не удалось создать PaymentIntent для записи ${appointment.id}: ${(error as Error).message}`,
      );
      return { ...this.toDto(appointment), paymentUnavailableReason: reason };
    }
  }

  /** Вызывается только вебхуком Stripe (см. `StripeWebhookController`) — не
   * владелец-CRUD-путь, поэтому не проверяет `ownerId`. Зеркало
   * `OrdersService.markPaidByPaymentIntent` — тот же комментарий про
   * `payment_intent.payment_failed` намеренно no-op применяется и здесь. */
  async markPaidByPaymentIntent(paymentIntentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });
    if (!appointment) {
      this.logger.warn(`Вебхук Stripe для неизвестного PaymentIntent ${paymentIntentId}`);
      return;
    }
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { paymentStatus: 'paid' },
    });
  }

  /** Возврат целиком, владелец-only — зеркало `OrdersService.refund`, тот же
   * порядок операций и та же причина (Stripe вызывается ДО записи в свою
   * БД, идемпотентно на стороне `StripeAdapter.refundPayment`), см. её
   * комментарий. */
  async refund(
    businessId: string,
    appointmentId: string,
    ownerId: string,
  ): Promise<AppointmentDto> {
    await this.assertOwnership(businessId, ownerId);
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment || appointment.businessId !== businessId) {
      throw new NotFoundException('Запись не найдена');
    }
    if (appointment.paymentStatus === 'unpaid') {
      throw new BadRequestException('Запись ещё не оплачена — возврат невозможен');
    }
    if (appointment.paymentStatus === 'refunded') {
      throw new BadRequestException('Запись уже возвращена');
    }
    if (!appointment.stripePaymentIntentId) {
      throw new BadRequestException('У записи нет привязанного платежа Stripe');
    }

    await this.paymentProvider.refundPayment(appointment.stripePaymentIntentId);

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: 'refunded' },
    });
    return this.toDto(updated);
  }

  async list(businessId: string, ownerId: string): Promise<AppointmentDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const appointments = await this.prisma.appointment.findMany({
      where: { businessId },
      orderBy: { startsAt: 'asc' },
    });
    return appointments.map((appointment) => this.toDto(appointment));
  }

  /** Публичный список свободных слотов на дату (см. `PublicSitesController.
   * getAvailability`) — тот же `computeAvailableSlots` (`lib/availability.ts`)
   * что и презентационный дефолт 09:00-18:00, когда бизнес не настраивал
   * часы: список слотов не должен быть пустым только потому, что владелец
   * ещё не заходил в настройки, хотя `createFromRequest` в этом случае и не
   * стал бы отклонять время вне этого дефолтного окна (см. её комментарий). */
  async getAvailability(businessId: string, serviceId: string, date: Date): Promise<string[]> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { workingHours: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId, isActive: true },
    });
    if (!service) throw new NotFoundException('Услуга не найдена');

    const existing = await this.findAppointmentsAround(businessId, date);
    const slots = computeAvailableSlots({
      date,
      durationMinutes: service.durationMinutes,
      workingHours: (business.workingHours as unknown as WorkingHours | null) ?? null,
      existing,
      now: new Date(),
    });
    return slots.map((slot) => slot.toISOString());
  }

  async updateStatus(
    businessId: string,
    appointmentId: string,
    ownerId: string,
    status: AppointmentStatus,
  ): Promise<AppointmentDto> {
    await this.assertOwnership(businessId, ownerId);
    const existing = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!existing || existing.businessId !== businessId) {
      throw new NotFoundException('Запись не найдена');
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status },
    });
    return this.toDto(updated);
  }

  /** Записи бизнеса в окне ±сутки вокруг `around` (см. `CONFLICT_WINDOW_MS`)
   * — общий источник данных для конфликт-проверки при создании и для
   * подсчёта свободных слотов, поэтому одна реализация, не две. `cancelled`
   * исключены — отменённая запись не занимает время. */
  private async findAppointmentsAround(
    businessId: string,
    around: Date,
  ): Promise<ExistingAppointment[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        businessId,
        status: { not: 'cancelled' },
        startsAt: {
          gte: new Date(around.getTime() - CONFLICT_WINDOW_MS),
          lt: new Date(around.getTime() + CONFLICT_WINDOW_MS),
        },
      },
      select: { startsAt: true, durationMinutes: true },
    });
    return appointments;
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private toDto(appointment: Appointment): AppointmentDto {
    return {
      id: appointment.id,
      businessId: appointment.businessId,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      priceCents: appointment.priceCents,
      durationMinutes: appointment.durationMinutes,
      currency: appointment.currency,
      status: appointment.status,
      startsAt: appointment.startsAt.toISOString(),
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail,
      customerPhone: appointment.customerPhone,
      customerNote: appointment.customerNote,
      paymentStatus: appointment.paymentStatus,
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
    };
  }
}
