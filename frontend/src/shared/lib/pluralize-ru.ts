/**
 * Русское склонение по числу: 1 форма / 2-4 форма / 5+ форма.
 * `pluralizeRu(3, ['друг', 'друга', 'друзей'])` → «друга».
 */
export function pluralizeRu(count: number, [one, few, many]: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
