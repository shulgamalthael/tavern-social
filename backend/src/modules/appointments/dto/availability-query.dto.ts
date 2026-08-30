import { Matches } from 'class-validator';

/** `?date=YYYY-MM-DD` — календарная дата без времени/зоны, тот же формат,
 * что и обычный HTML `<input type="date">` отдаёт без какой-либо обработки
 * (см. `BookingModal.tsx`) — не `@IsDateString()` (тот принимает полный
 * ISO-timestamp, что усложнило бы вызов с frontend без реальной пользы:
 * время внутри дня здесь всё равно не нужно, оно есть в ответе). */
export class AvailabilityQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Дата должна быть в формате ГГГГ-ММ-ДД' })
  date!: string;
}
