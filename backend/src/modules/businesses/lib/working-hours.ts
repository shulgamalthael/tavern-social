/**
 * Часы работы бизнеса (`Business.workingHours`, см. schema.prisma) — общий
 * тип/утилиты между `UpdateBusinessDto` (валидация формы владельца) и
 * `AppointmentsService` (проверка при записи + подсчёт свободных слотов),
 * поэтому живут здесь, а не в `modules/appointments` — само поле хранится
 * на `Business`, Booking лишь один из потребителей.
 */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  /** `"HH:mm"`, 24-часовой формат — см. `TIME_PATTERN`. */
  open: string;
  close: string;
}

export type WorkingHours = Partial<Record<Weekday, DayHours>>;

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `Date.getDay()` (0 = воскресенье) → ключ `WorkingHours` — JS и эта схема
 * нумеруют дни недели по-разному (JS с воскресенья, здесь с понедельника,
 * как принято в расписаниях), это единственное место, которое переводит
 * одно в другое. */
const WEEKDAY_BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function weekdayOf(date: Date): Weekday {
  return WEEKDAY_BY_JS_DAY[date.getDay()];
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
