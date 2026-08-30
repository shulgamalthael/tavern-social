import { Matches } from 'class-validator';
import { TIME_PATTERN } from '../lib/working-hours';

/** Один день из `WorkingHoursDto` — `open < close` проверяется в сервисе
 * (`BusinessesService.assertValidWorkingHours`), не декоратором: сравнение
 * двух полей друг с другом — тот же приём, что и `DiscountsService.
 * assertPercentageBound` для `type`/`value`. */
export class DayHoursDto {
  @Matches(TIME_PATTERN, { message: 'Время открытия должно быть в формате ЧЧ:ММ' })
  open!: string;

  @Matches(TIME_PATTERN, { message: 'Время закрытия должно быть в формате ЧЧ:ММ' })
  close!: string;
}
