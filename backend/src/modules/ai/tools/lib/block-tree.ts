import type { WebsiteBlock, WebsitePage } from '@/modules/websites/websites.types';

/** Рекурсивный поиск/замена блока по id в дереве страниц документа — общая
 * утилита для `set_style`/`update_block_props` (оба находят СУЩЕСТВУЮЩИЙ
 * блок где угодно на сайте, не только на верхнем уровне страницы: блоки
 * могут лежать внутри `section`/`container`/`columns`/`column`, см.
 * `WebsiteBlock.children` в `websites.types.ts`). Чистые функции без
 * NestJS-зависимостей — тот же приём, что и `lib/add-block-schemas.ts`,
 * ради юнит-тестируемости без DI (`block-tree.test.ts`). */

export interface FoundBlock {
  page: WebsitePage;
  block: WebsiteBlock;
}

export function findBlockInPages(pages: WebsitePage[], blockId: string): FoundBlock | null {
  for (const page of pages) {
    const block = findBlockInTree(page.blocks, blockId);
    if (block) return { page, block };
  }
  return null;
}

function findBlockInTree(blocks: WebsiteBlock[], blockId: string): WebsiteBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) return block;
    if (block.children) {
      const found = findBlockInTree(block.children, blockId);
      if (found) return found;
    }
  }
  return null;
}

/** Возвращает НОВЫЙ массив страниц с ровно одним блоком (по id, где угодно
 * в дереве) заменённым результатом `updater` — остальные блоки и структура
 * дерева не трогаются (иммутабельно на каждом уровне, до самого корня, тем
 * же способом, что и `insertBlock`/`moveBlock` на frontend, `model/block-
 * tree.ts`, просто backend-версия ровно того, что здесь реально нужно:
 * замена одного узла, не вставка/перемещение). Если `blockId` не найден ни
 * на одной странице — возвращает исходный массив без изменений (вызывающий
 * код обязан сам проверить `findBlockInPages` заранее и явно сообщить об
 * ошибке, эта функция не бросает молча). */
export function replaceBlockInPages(
  pages: WebsitePage[],
  blockId: string,
  updater: (block: WebsiteBlock) => WebsiteBlock,
): WebsitePage[] {
  return pages.map((page) => ({
    ...page,
    blocks: replaceBlockInTree(page.blocks, blockId, updater),
  }));
}

function replaceBlockInTree(
  blocks: WebsiteBlock[],
  blockId: string,
  updater: (block: WebsiteBlock) => WebsiteBlock,
): WebsiteBlock[] {
  return blocks.map((block) => {
    if (block.id === blockId) return updater(block);
    if (block.children) {
      return { ...block, children: replaceBlockInTree(block.children, blockId, updater) };
    }
    return block;
  });
}
