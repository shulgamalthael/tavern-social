/** «Сегодня»/«Вчера»/дата — для группировки списков по дню (уведомления, чат). */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}
