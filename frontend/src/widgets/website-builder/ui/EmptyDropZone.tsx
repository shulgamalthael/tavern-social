'use client';

import { useDroppable } from '@dnd-kit/core';
import { useWebsiteBuilderStore } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { PlusIcon } from '@/shared/ui/icons';
import styles from './EmptyDropZone.module.scss';

export interface EmptyDropZoneProps {
  /** `null` — пустая страница целиком (см. `Canvas.tsx`), иначе id
   * контейнерного блока без детей (см. `CanvasBlock.tsx`). Формирует id
   * зоны `empty:root`/`empty:<id блока>` — `Canvas.tsx`, `onDragEnd`
   * разбирает этот префикс, чтобы понять, что перетаскиваемый элемент
   * нужно вставить внутрь именно сюда, а не куда-то в середину списка. */
  containerId: string | null;
  label?: string;
}

/**
 * Кликабельна, не только droppable — раньше единственным способом
 * заполнить пустую страницу/контейнер был драг, а drag-and-drop на
 * тачскрине не всегда самоочевиден (см. корневой план задачи: «добавление
 * виджетов работает не явно»). Клик открывает тот же `AddBlockModal.tsx`,
 * что и кнопки «+» между блоками (`InsertBlockButton.tsx`), с той же
 * запомненной позицией — просто эта конкретная зона всегда пустая, поэтому
 * позиция всегда «в начало этого контейнера» (`index: 0`).
 */
export function EmptyDropZone({ containerId, label }: EmptyDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `empty:${containerId ?? 'root'}`,
    data: { kind: 'empty-zone', containerId },
  });
  const openInsertPicker = useWebsiteBuilderStore((state) => state.openInsertPicker);
  const selectBlock = useWebsiteBuilderStore((state) => state.selectBlock);

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={cn(styles.zone, isOver && styles['zone--over'])}
      onClick={(event) => {
        event.stopPropagation();
        // Пустой контейнер (не пустая страница целиком) занимает клетчатой
        // зоной весь свой контент — кликнуть «мимо» неё внутри контейнера
        // физически нельзя, поэтому клик сюда одновременно ещё и выбирает
        // сам контейнер: если пользователь передумает и закроет модалку
        // ничего не выбрав, он не останется с ощущением «я что-то нажал, а
        // ничего не выбралось» (см. корневой план задачи, «пользователь
        // должен понимать, что сейчас выбрано»).
        if (containerId) selectBlock(containerId);
        openInsertPicker(containerId, 0);
      }}
    >
      <PlusIcon className={styles.zone__icon} />
      {label ?? 'Добавить компонент'}
    </button>
  );
}
