import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import type { AppointmentDto } from './appointments.types';
import { AppointmentsService } from './appointments.service';

/** Владелец-only — создание записи (анонимная витрина) живёт отдельно, в
 * `PublicSitesController` (см. `AppointmentsService.createFromRequest`),
 * тот же принцип, что и у `OrdersController`/`PublicSitesController.
 * createOrder`. */
@Controller('businesses/:businessId/appointments')
@UseGuards(SessionAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<AppointmentDto[]> {
    return this.appointmentsService.list(businessId, currentUser.id);
  }

  @Patch(':appointmentId')
  updateStatus(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.updateStatus(
      businessId,
      appointmentId,
      currentUser.id,
      dto.status,
    );
  }

  @Post(':appointmentId/refund')
  refund(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('appointmentId') appointmentId: string,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.refund(businessId, appointmentId, currentUser.id);
  }
}
