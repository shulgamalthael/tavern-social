import type { WebsiteBlock } from '@/modules/websites/websites.types';

/**
 * Считает блоки данного `type` во всех страницах сайта — используется
 * `AdvertisingInventoryService.getInventory` как единственный способ узнать
 * `occupied` (сколько рекламных слотов уже размещено), БЕЗ отдельной
 * таблицы учёта слотов: тот же принцип "выводить, а не дублировать
 * состояние", что и `ALLOWED_BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS)`
 * (`add-block-schemas.ts`) — источник истины про размещение блоков уже
 * есть (`WebsitePage.content`), заводить второй означал бы держать два
 * места в ручной синхронизации.
 *
 * `pagesContent` — сырые значения столбца `WebsitePage.content: Json` (по
 * одному на страницу) — Prisma не гарантирует форму JSON-поля на уровне
 * типов, поэтому вход `unknown`, приводится к `WebsiteBlock[]` так же, как
 * это уже делает `WebsitesService.assembleDocument`.
 */
export function countBlocksOfType(pagesContent: readonly unknown[], type: string): number {
  let count = 0;
  for (const content of pagesContent) {
    const blocks = (content as WebsiteBlock[] | null | undefined) ?? [];
    count += countInTree(blocks, type);
  }
  return count;
}

function countInTree(blocks: WebsiteBlock[], type: string): number {
  let count = 0;
  for (const block of blocks) {
    if (block.type === type) count += 1;
    if (block.children) count += countInTree(block.children, type);
  }
  return count;
}
