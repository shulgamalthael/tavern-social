import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Appointment } from '@prisma/client';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateAppointmentDto } from './dto/create-appointment.dto';
import type { AppointmentDto, AppointmentStatus } from './appointments.types';

/**
 * Заявки на запись с анонимной витрины (см. `PublicSitesController.
 * createAppointment`) — без движка доступности (см. комментарий модели
 * `Appointment` в schema.prisma): клиент присылает желаемое время, владелец
 * подтверждает вручную. Владелец-CRUD (`list`/`updateStatus`) вложен под
 * `/businesses/:businessId/appointments`, тот же принцип, что у
 * `OrdersService`.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
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
      select: { id: true, currency: true },
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
    return this.toDto(appointment);
  }

  async list(businessId: string, ownerId: string): Promise<AppointmentDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const appointments = await this.prisma.appointment.findMany({
      where: { businessId },
      orderBy: { startsAt: 'asc' },
    });
    return appointments.map((appointment) => this.toDto(appointment));
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
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
    };
  }
}
