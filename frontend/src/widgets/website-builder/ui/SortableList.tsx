'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

export interface SortableListProps {
  /** Совпадает с id родительского блока, `'root'` — верхний уровень
   * страницы (см. `Canvas.tsx`) — dnd-kit сам прокидывает его в `data.
   * current.sortable.containerId` каждого элемента списка, поэтому
   * `onDragEnd` узнаёт целевого родителя без своей карты id → parentId. */
  id: string;
  items: string[];
  children: ReactNode;
}

/** Тонкая обёртка над `SortableContext` — один и тот же вызов что для
 * верхнего уровня страницы (см. `Canvas.tsx`), что для детей любого
 * контейнерного блока (см. `CanvasBlock.tsx`): каждый уровень вложенности
 * дерева блоков — свой независимый `SortableContext`, дети переставляются
 * внутри него, а перенос между уровнями решает общий `onDragEnd` в
 * `Canvas.tsx` по `data.current.sortable` перетаскиваемого/целевого
 * элемента. */
export function SortableList({ id, items, children }: SortableListProps) {
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}
