/** «с марта 2026» из ISO-даты — используется для «друзья с …». */
export function formatSinceDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(
    new Date(iso),
  );
  return `с ${formatted}`;
}
