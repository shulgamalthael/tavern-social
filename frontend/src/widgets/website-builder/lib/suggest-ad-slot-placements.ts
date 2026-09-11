import type { WebsiteBlock } from '@/entities/website';

/**
 * Типы верхнеуровневых блоков, рядом с которыми рекламный слот НИКОГДА не
 * предлагается — hero-блоки (первое, что видит посетитель), любые формы
 * (заполнение формы — не место для отвлечения), шапка бизнеса и структурная
 * навигация/подвал (эти блоки не «контент страницы», а её каркас). Список
 * сверен с реальными типами allowlist'а (`entities/website/blocks/*`), не
 * гипотетическими именами.
 */
const SKIPPED_BLOCK_TYPES = new Set([
  'hero',
  'herovideo',
  'herosplitform',
  'businessheader',
  'contactform',
  'newsletterform',
  'simpleform',
  'newsletterpopup',
  'anchornav',
  'breadcrumbs',
  'footer',
]);

/** Каждый N-й «контентный» (не входящий в `SKIPPED_BLOCK_TYPES`) блок
 * получает предложение вставить рекламный слот сразу после себя — «после
 * каждого 2–3 блока» из корневого плана фичи, зафиксировано как 2 (нижняя
 * граница диапазона: реже — слоты не используют предоставленный тарифом
 * лимит, чаще — реальный риск навязчивости, который сама фича обязана
 * избегать). */
const CONTENT_BLOCK_INTERVAL = 2;

/**
 * Предлагает позиции вставки блока `adslot` на верхнем уровне страницы —
 * чистая функция (без побочных эффектов, без обращения к стору), см.
 * корневой план фичи §6: «Auto-placement… не мгновенно/автоматический
 * процесс, а одна кнопка билдера». Возвращает индексы ВСТАВКИ в терминах
 * ИСХОДНОГО массива `blocks` (до любых вставок) — вызывающий код обязан
 * применять их в ПОРЯДКЕ УБЫВАНИЯ (см. `useAutoPlaceAdSlots` ниже), иначе
 * более ранняя вставка сдвинет индексы более поздних предложений.
 *
 * Логика: считает только "контентные" блоки (не входящие в `SKIPPED_BLOCK_
 * TYPES`), предлагает вставку после каждого `CONTENT_BLOCK_INTERVAL`-го из
 * них — но ТОЛЬКО если следующий блок (тот, что окажется сразу после
 * вставленного слота) сам не входит в `SKIPPED_BLOCK_TYPES`: иначе слот
 * оказался бы зажат прямо перед формой/hero/подвалом, ровно то, что мисси
 * фичи запрещает («никогда не внутри hero, форм, чекаута, нав»). Не
 * предлагает больше, чем `availableCount` (реальный оставшийся лимит
 * тарифа, см. `AdvertisingInventoryService.getInventory(...).available`).
 */
export function suggestAdSlotPlacements(blocks: WebsiteBlock[], availableCount: number): number[] {
  if (availableCount <= 0) return [];

  const suggestions: number[] = [];
  let contentCount = 0;

  for (let index = 0; index < blocks.length && suggestions.length < availableCount; index += 1) {
    if (SKIPPED_BLOCK_TYPES.has(blocks[index].type)) continue;

    contentCount += 1;
    if (contentCount % CONTENT_BLOCK_INTERVAL !== 0) continue;

    const insertionIndex = index + 1;
    const nextBlock = blocks[insertionIndex];
    if (nextBlock && SKIPPED_BLOCK_TYPES.has(nextBlock.type)) continue;

    suggestions.push(insertionIndex);
  }

  return suggestions;
}
