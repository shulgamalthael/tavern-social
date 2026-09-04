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

/** Число блоков в поддереве, САМ узел не считая — используется `delete_block`,
 * чтобы вернуть модели (и через неё — владельцу) честное число «а сколько
 * ещё блоков удалится вместе с этим», раз карточка подтверждения (AI-9,
 * `AiChatPanel.tsx`) сегодня не показывает произвольные детали `args`, только
 * имя инструмента — см. комментарий `DeleteBlockTool`. */
export function countDescendants(block: WebsiteBlock): number {
  const children = block.children ?? [];
  return children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

/** `true`, если `candidateId` — это сам `block` или лежит где-то в его
 * поддереве. `move_block` обязан проверить это ПЕРЕД перемещением: без этой
 * проверки перенос контейнера внутрь собственного потомка не просто
 * бессмысленная операция, а тихая потеря данных — см. предупреждение у
 * `MoveBlockTool` и идентичный, независимо найденный по этому же поводу
 * латентный баг во frontend-версии `moveBlock` (`entities/website/model/
 * block-tree.ts`), исправленный тем же приёмом в той же итерации. */
export function isBlockOrDescendant(block: WebsiteBlock, candidateId: string): boolean {
  if (block.id === candidateId) return true;
  return (block.children ?? []).some((child) => isBlockOrDescendant(child, candidateId));
}

/** id родительского контейнера блока НА ОДНОЙ СТРАНИЦЕ (`blocks` — уже
 * `page.blocks` конкретной страницы, не весь документ) — `null`, если блок
 * лежит на верхнем уровне этой страницы, `undefined`, если id вообще не
 * найден в этом дереве. Backend-версия `findParentId` с frontend (`model/
 * block-tree.ts`) — там же используется, чтобы понять, в какой массив
 * детей вставлять перемещённый блок обратно, если вызывающий код не назвал
 * новый родитель явно (см. `MoveBlockTool`: «не передан parentId» = «оставь
 * в текущем родителе», а не «перенеси на верхний уровень» — иначе почти
 * любой вызов «переставь блок на позицию N» без явной причины сменил бы ему
 * родителя). */
export function findParentIdInBlocks(
  blocks: WebsiteBlock[],
  blockId: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const block of blocks) {
    if (block.id === blockId) return parentId;
    if (block.children) {
      const found = findParentIdInBlocks(block.children, blockId, block.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Убирает блок с данным id, где бы он ни был на любой странице документа —
 * возвращает и новый массив страниц, и сам убранный блок (со всеми его
 * `children`, если были — удаление блока-контейнера удаляет и всё, что
 * внутри, ровно как при удалении руками в билдере). `removed: null`, если
 * id нигде не найден — вызывающий код обязан проверить `findBlockInPages`
 * заранее и явно сообщить об ошибке, эта функция не бросает молча (тот же
 * контракт, что у `replaceBlockInPages`). */
export function removeBlockFromPages(
  pages: WebsitePage[],
  blockId: string,
): { pages: WebsitePage[]; removed: WebsiteBlock | null } {
  let removed: WebsiteBlock | null = null;

  function walk(blocks: WebsiteBlock[]): WebsiteBlock[] {
    const next: WebsiteBlock[] = [];
    for (const block of blocks) {
      if (block.id === blockId) {
        removed = block;
        continue;
      }
      if (block.children) {
        const children = walk(block.children);
        next.push(children === block.children ? block : { ...block, children });
      } else {
        next.push(block);
      }
    }
    return next;
  }

  const nextPages = pages.map((page) => ({ ...page, blocks: walk(page.blocks) }));
  return { pages: nextPages, removed };
}

/** Вставляет `block` на страницу `pageId` — на верхний уровень (`parentId:
 * null`) или внутрь контейнера `parentId` на ЭТОЙ ЖЕ странице, в позицию
 * `index` (обрезается к границам массива — отрицательные значения и
 * значения больше длины безопасны, «в начало»/«в конец»). Вызывающий код
 * (`MoveBlockTool`) обязан заранее проверить, что `parentId` существует на
 * этой странице, это допустимый тип контейнера и что он принимает данный
 * тип ребёнка (`ALLOWED_CHILDREN`, `add-block-schemas.ts`) — эта функция
 * сама таких проверок не делает (в отличие от frontend-версии `insertBlock`,
 * которая при недопустимой вставке молча возвращает `blocks` нетронутым) —
 * здесь вызывающий код должен явно сообщить модели, ПОЧЕМУ перемещение не
 * выполнено, а не тихо проглотить операцию. */
export function insertBlockIntoPage(
  pages: WebsitePage[],
  pageId: string,
  block: WebsiteBlock,
  parentId: string | null,
  index: number,
): WebsitePage[] {
  return pages.map((page) => {
    if (page.id !== pageId) return page;
    if (parentId === null) {
      const clamped = Math.max(0, Math.min(index, page.blocks.length));
      return {
        ...page,
        blocks: [...page.blocks.slice(0, clamped), block, ...page.blocks.slice(clamped)],
      };
    }
    return { ...page, blocks: insertIntoTree(page.blocks, block, parentId, index) };
  });
}

function insertIntoTree(
  blocks: WebsiteBlock[],
  block: WebsiteBlock,
  parentId: string,
  index: number,
): WebsiteBlock[] {
  return blocks.map((existing) => {
    if (existing.id === parentId) {
      const children = existing.children ?? [];
      const clamped = Math.max(0, Math.min(index, children.length));
      return {
        ...existing,
        children: [...children.slice(0, clamped), block, ...children.slice(clamped)],
      };
    }
    if (existing.children) {
      const children = insertIntoTree(existing.children, block, parentId, index);
      if (children !== existing.children) return { ...existing, children };
    }
    return existing;
  });
}
