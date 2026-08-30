import {
  timeToMinutes,
  weekdayOf,
  type WorkingHours,
} from '@/modules/businesses/lib/working-hours';

/** Шаг сетки слотов — длительность самой услуги: слоты идут строго один за
 * другим (09:00, 09:45, 10:30 для 45-минутной услуги), никогда не
 * перекрываясь друг с другом ещё до учёта существующих записей. Фиксированная
 * сетка (например, каждые 15 минут) добавила бы возможность предлагать
 * слоты, которые перекрывают друг друга по длительности услуги — не то, что
 * нужно для одного «сотрудника» (см. `Service`'s комментарий про отсутствие
 * `Employee` в этом инкременте).
 */
const DEFAULT_DAY_WINDOW = { open: '09:00', close: '18:00' } as const;

export interface ExistingAppointment {
  startsAt: Date;
  durationMinutes: number;
}

function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** `workingHours` отсутствует целиком (бизнес никогда не настраивал часы) —
 * `null`, не выброс: означает «без ограничения по часам», см. комментарий
 * `Business.workingHours` в schema.prisma. День присутствует в объекте, но
 * без своего значения (`undefined`)/явно выключен — закрыт в этот день. */
export function dayWindowFor(
  workingHours: WorkingHours | null,
  date: Date,
): { open: string; close: string } | null {
  if (!workingHours) return DEFAULT_DAY_WINDOW;
  const hours = workingHours[weekdayOf(date)];
  return hours ?? null;
}

/** Проверка при СОЗДАНИИ записи (см. `AppointmentsService.createFromRequest`)
 * — в отличие от `computeAvailableSlots` ниже, здесь НЕТ дефолтного окна
 * 09:00-18:00, когда часы не заданы вообще: незаданные часы значат
 * «без ограничения» для реального создания записи (обратная совместимость,
 * см. `Business.workingHours`), дефолт в `computeAvailableSlots` — только
 * презентационный, чтобы список слотов не был пустым у бизнеса, который ещё
 * не настроил часы. */
export function isWithinWorkingHours(
  workingHours: WorkingHours | null,
  startsAt: Date,
  endsAt: Date,
): boolean {
  if (!workingHours) return true;

  const sameDay =
    startsAt.getFullYear() === endsAt.getFullYear() &&
    startsAt.getMonth() === endsAt.getMonth() &&
    startsAt.getDate() === endsAt.getDate();
  if (!sameDay) return false;

  const hours = workingHours[weekdayOf(startsAt)];
  if (!hours) return false;

  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMinutes = endsAt.getHours() * 60 + endsAt.getMinutes();
  return startMinutes >= timeToMinutes(hours.open) && endMinutes <= timeToMinutes(hours.close);
}

/** Пересекается ли `[startsAt, startsAt + durationMinutes)` с любой из
 * `existing` — единственная проверка «двойной записи», не зависящая от того,
 * заданы ли часы работы вообще (см. `createFromRequest`: применяется всегда,
 * `isWithinWorkingHours` — только когда часы настроены). */
export function findConflict(
  startsAt: Date,
  durationMinutes: number,
  existing: ExistingAppointment[],
): ExistingAppointment | undefined {
  const start = startsAt.getTime();
  const end = start + durationMinutes * 60_000;

  return existing.find((appointment) => {
    const otherStart = appointment.startsAt.getTime();
    const otherEnd = otherStart + appointment.durationMinutes * 60_000;
    return intervalsOverlap(start, end, otherStart, otherEnd);
  });
}

/**
 * Свободные слоты на конкретную календарную дату для услуги заданной
 * длительности — используется публичным `GET .../availability` (см.
 * `AppointmentsService.getAvailability`). `now` — отдельный параметр (не
 * `new Date()` внутри) ради тестируемости чистой функции, тот же приём, что
 * `calculateOrderPricing` уже использует для дат в Pricing Engine.
 */
export function computeAvailableSlots(params: {
  date: Date;
  durationMinutes: number;
  workingHours: WorkingHours | null;
  existing: ExistingAppointment[];
  now: Date;
}): Date[] {
  const { date, durationMinutes, workingHours, existing, now } = params;
  const window = dayWindowFor(workingHours, date);
  if (!window) return [];

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const openMinutes = timeToMinutes(window.open);
  const closeMinutes = timeToMinutes(window.close);

  const slots: Date[] = [];
  for (
    let startMinutes = openMinutes;
    startMinutes + durationMinutes <= closeMinutes;
    startMinutes += durationMinutes
  ) {
    const slotStart = new Date(dayStart.getTime() + startMinutes * 60_000);
    if (slotStart <= now) continue;
    if (!findConflict(slotStart, durationMinutes, existing)) {
      slots.push(slotStart);
    }
  }
  return slots;
}
