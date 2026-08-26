import { IsDateString, IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { LOOSE_PHONE_MESSAGE, LOOSE_PHONE_PATTERN } from '@/common/lib/phone-validation';

/** Только `serviceId`/`startsAt` — НИКАКИХ `serviceName`/`priceCents`/
 * `durationMinutes` от клиента, тот же принцип, что и у `CreateOrderItemDto`
 * (анонимный посетитель мог бы прислать любую цену/длительность). Реальные
 * значения подставляются на backend из текущего `Service` (см.
 * `AppointmentsService.createFromRequest`). */
export class CreateAppointmentDto {
  @IsString()
  serviceId!: string;

  /** Желаемое время начала — ISO-строка. Без выбора из уже посчитанных
   * свободных слотов (нет движка доступности в этом инкременте, см.
   * комментарий модели `Appointment` в schema.prisma) — клиент присылает
   * то время, которое хочет, владелец подтверждает или предлагает другое
   * вручную. */
  @IsDateString({}, { message: 'Некорректная дата и время' })
  startsAt!: string;

  @IsString()
  @Length(1, 120, { message: 'Укажите имя' })
  customerName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  customerEmail?: string;

  @IsOptional()
  @Matches(LOOSE_PHONE_PATTERN, { message: LOOSE_PHONE_MESSAGE })
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: 'Комментарий не должен превышать 1000 символов' })
  customerNote?: string;
}
