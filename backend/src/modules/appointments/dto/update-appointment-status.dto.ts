import { IsIn } from 'class-validator';
import type { AppointmentStatus } from '../appointments.types';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
];

export class UpdateAppointmentStatusDto {
  @IsIn(APPOINTMENT_STATUSES, { message: 'Недопустимый статус записи' })
  status!: AppointmentStatus;
}
