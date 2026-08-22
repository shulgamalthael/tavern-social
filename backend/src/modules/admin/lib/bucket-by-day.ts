import type { AdminDailyPoint } from '../admin.types';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Считает записи по дням за последние `days` дней (включая сегодня) —
 * общий формат для любого временного ряда на дашборде (см. `AdminDailyPoint`).
 * Дни без единой записи всё равно попадают в результат с `count: 0` — иначе
 * график графика (`dataviz`) читался бы как «дырка», а не как «ноль».
 */
export function bucketByDay(dates: Date[], days: number): AdminDailyPoint[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = toDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const points: AdminDailyPoint[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    const key = toDateKey(day);
    points.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return points;
}
