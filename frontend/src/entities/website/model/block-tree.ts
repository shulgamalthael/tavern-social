import { getBlockDefinition } from './registry';
import type { WebsiteBlock } from './types';

/** `undefined` — верхний уровень страницы, у неё нет собственного типа блока
 * и он всегда принимает что угодно (то же историческое поведение, что и у
 * контейнера без `allowedChildren`, см. `BlockDefinition.allowedChildren` в
 * `registry.ts`). */
function canAcceptChild(parentType: string | undefined, childType: string): boolean {
  if (parentType === undefined) return true;
  const allowedChildren = getBlockDefinition(parentType)?.allowedChildren;
  if (!allowedChildren) return true;
  return allowedChildren.includes(childType);
}

export function createBlockId(): string {
  return crypto.randomUUID();
}

/** Пересобирает блок (и рекурсивно его `children`, если есть) со свежими
 * `id` — используется при вставке готового набора блоков, откуда бы он ни
 * пришёл (стартовый шаблон, сохранённый виджет), чтобы одна и та же
 * заготовка, вставленная дважды, не породила два блока с одинаковым id (см.
 * `website-store.ts`'s `insertWidgetBlocks`). Рекурсивная, не плоская — на
 * случай будущего блока-виджета с `children`, хотя сегодняшние 4 curated
 * типа (`heading`/`text`/`quote`/`spacer`) листовые. */
export function remapBlockIds(block: WebsiteBlock): WebsiteBlock {
  const remapped: WebsiteBlock = { ...block, id: createBlockId() };
  if (block.children) {
    remapped.children = block.children.map(remapBlockIds);
  }
  return remapped;
}

/** Рекурсивный поиск блока по id — глубина дерева на практике маленькая
 * (section → columns → column → блок, 3-4 уровня), линейный обход без
 * индекса более чем достаточен и не требует поддерживать отдельную
 * плоскую карту id → блок синхронно с деревом. */
export function findBlock(blocks: WebsiteBlock[], id: string): WebsiteBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlock(block.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** id родительского контейнера блока — `null`, если блок на верхнем уровне
 * страницы (не вложен ни в один контейнер). Нужен, чтобы понять, в какой
 * массив детей вставлять дубликат/перемещённый блок рядом с оригиналом. */
export function findParentId(
  blocks: WebsiteBlock[],
  id: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const block of blocks) {
    if (block.id === id) return parentId;
    if (block.children) {
      const found = findParentId(block.children, id, block.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Иммутабельно применяет `updater` к блоку с данным id, где бы он ни был в
 * дереве — используется для правки `props`/`style`/`hidden` (см.
 * `website-store.ts`, `updateBlockProps`/`updateBlockStyle`). Возвращает
 * новый массив верхнего уровня; ветки дерева, которых правка не коснулась,
 * остаются теми же ссылками (обычная иммутабельная экономия перерендеров). */
export function updateBlock(
  blocks: WebsiteBlock[],
  id: string,
  updater: (block: WebsiteBlock) => WebsiteBlock,
): WebsiteBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return updater(block);
    if (block.children) {
      const children = updateBlock(block.children, id, updater);
      if (children !== block.children) return { ...block, children };
    }
    return block;
  });
}

export function removeBlock(
  blocks: WebsiteBlock[],
  id: string,
): { blocks: WebsiteBlock[]; removed: WebsiteBlock | null } {
  let removed: WebsiteBlock | null = null;

  function walk(list: WebsiteBlock[]): WebsiteBlock[] {
    const next: WebsiteBlock[] = [];
    for (const block of list) {
      if (block.id === id) {
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

  return { blocks: walk(blocks), removed };
}

/** Вставляет блок на верхний уровень (`parentId: null`) или внутрь
 * контейнера с данным id, в позицию `index` (обрезается к границам массива,
 * так что `Infinity`/отрицательные значения безопасны — «в конец»/«в
 * начало»). Недопустимая вставка (тип ребёнка не входит в `allowedChildren`
 * родителя, см. `registry.ts`) отклоняется целиком — возвращает `blocks` без
 * изменений, а не вставляет блок частично или в неверное место. */
export function insertBlock(
  blocks: WebsiteBlock[],
  block: WebsiteBlock,
  parentId: string | null,
  index: number,
): WebsiteBlock[] {
  if (parentId === null) {
    const clamped = Math.max(0, Math.min(index, blocks.length));
    return [...blocks.slice(0, clamped), block, ...blocks.slice(clamped)];
  }

  const parent = findBlock(blocks, parentId);
  if (!parent || !canAcceptChild(parent.type, block.type)) return blocks;

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
      const children = insertBlock(existing.children, block, parentId, index);
      if (children !== existing.children) return { ...existing, children };
    }
    return existing;
  });
}

/** Недопустимое перемещение (см. `insertBlock`) отклоняется целиком —
 * возвращает исходный `blocks` НЕТРОНУТЫМ. Важно проверить это до вызова
 * `insertBlock`, а не полагаться только на её собственную защиту: та в
 * случае отказа вернула бы `blocks` уже БЕЗ перемещаемого блока (он к тому
 * моменту убран `removeBlock` ниже) — то есть недопустимый drop иначе не
 * «ничего не делает», а тихо удаляет блок. */
export function moveBlock(
  blocks: WebsiteBlock[],
  blockId: string,
  targetParentId: string | null,
  targetIndex: number,
): WebsiteBlock[] {
  const moving = findBlock(blocks, blockId);
  if (!moving) return blocks;

  if (targetParentId !== null) {
    const targetParent = findBlock(blocks, targetParentId);
    if (!targetParent || !canAcceptChild(targetParent.type, moving.type)) return blocks;
  }

  const { blocks: withoutBlock, removed } = removeBlock(blocks, blockId);
  if (!removed) return blocks;
  return insertBlock(withoutBlock, removed, targetParentId, targetIndex);
}

function cloneWithNewIds(block: WebsiteBlock): WebsiteBlock {
  return {
    ...block,
    id: createBlockId(),
    children: block.children?.map(cloneWithNewIds),
  };
}

/** Дубликат встаёт сразу за оригиналом, в том же родителе — самое
 * предсказуемое место для него, не требует от пользователя потом искать
 * копию где-то ещё. */
export function duplicateBlock(blocks: WebsiteBlock[], blockId: string): WebsiteBlock[] {
  const original = findBlock(blocks, blockId);
  if (!original) return blocks;

  const parentId = findParentId(blocks, blockId);
  if (parentId === undefined) return blocks;

  const duplicate = cloneWithNewIds(original);
  const siblings = parentId === null ? blocks : (findBlock(blocks, parentId)?.children ?? []);
  const originalIndex = siblings.findIndex((item) => item.id === blockId);

  return insertBlock(blocks, duplicate, parentId, originalIndex + 1);
}

export function countBlocks(blocks: WebsiteBlock[]): number {
  return blocks.reduce(
    (total, block) => total + 1 + (block.children ? countBlocks(block.children) : 0),
    0,
  );
}
