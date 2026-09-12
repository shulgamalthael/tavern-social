/**
 * Предикат региональной фильтрации — вынесен из `AdEngineService.
 * filterByCountry` в чистую функцию по той же причине, что и `lib/
 * clearing-price.ts`/`lib/effective-bid.ts`: юнит-тестируется напрямую, без
 * реальных IP/GeoIP-данных. Пусто в `targetCountries` — кампания видна из
 * любой страны (та же семантика "пусто значит везде", что у
 * `targetCategories`). `visitorCountry: null` (страну не удалось
 * определить — см. `resolveVisitorCountry`) НЕ проходит непустой список —
 * безопасный дефолт: неопознанному посетителю не показываем гео-
 * ограниченную рекламу, а не угадываем.
 */
export function matchesVisitorCountry(
  targetCountries: string[],
  visitorCountry: string | null | undefined,
): boolean {
  if (targetCountries.length === 0) return true;
  return !!visitorCountry && targetCountries.includes(visitorCountry);
}
