/** `durationMinutes` → человекочитаемая строка («45 мин», «1 ч 30 мин»,
 * «2 ч») — единственное место, которое умеет это делать (см. `formatMoney`
 * в `shared/lib/format-money.ts` для того же приёма с ценой). */
export function formatDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}
