'use client';

import type { CustomWidget } from '@/entities/custom-widget';
import {
  findBlock,
  findParentId,
  useWebsiteBuilderStore,
  type LayoutPattern,
} from '@/entities/website';
import { Modal } from '@/shared/ui/Modal';
import { ComponentLibraryPanel } from './ComponentLibraryPanel';
import styles from './AddBlockModal.module.scss';

/**
 * Модалка выбора компонента для кнопок «+» вокруг блока (сверху/снизу —
 * `InsertBlockButton.tsx`, слева/справа — `InsertSideZone.tsx`) —
 * рендерится один раз здесь, в `WebsiteBuilderWidget.tsx`, а не в каждой
 * кнопке «+»: позиция/анкор вставки уже запомнены в сторе (`insertionTarget`,
 * см. `website-store.ts`), кнопке достаточно один раз позвать
 * `openInsertPicker`/`openInsertPickerBeside` и не знать про саму модалку
 * вообще. Переиспользует ту же сетку компонентов, что и раскладная панель
 * «Блоки» (`ComponentLibraryPanel`), просто с другим поведением клика —
 * вставка в запомненную позицию (или обёртка в колонки рядом с анкором)
 * вместо добавления в конец страницы.
 */
export interface AddBlockModalProps {
  businessId: string;
  /** Прокидывается напрямую в `ComponentLibraryPanel` — см. её комментарий. */
  capabilities?: string[];
}

export function AddBlockModal({ businessId, capabilities }: AddBlockModalProps) {
  const insertionTarget = useWebsiteBuilderStore((state) => state.insertionTarget);
  const document = useWebsiteBuilderStore((state) => state.document);
  const activePageId = useWebsiteBuilderStore((state) => state.activePageId);
  const addBlock = useWebsiteBuilderStore((state) => state.addBlock);
  const insertBlockBeside = useWebsiteBuilderStore((state) => state.insertBlockBeside);
  const insertWidgetBlocks = useWebsiteBuilderStore((state) => state.insertWidgetBlocks);
  const closeInsertPicker = useWebsiteBuilderStore((state) => state.closeInsertPicker);

  if (!insertionTarget) return null;
  const target = insertionTarget;

  function handleAdd(type: string) {
    if (target.mode === 'sibling') {
      addBlock(type, target.parentId, target.index);
    } else {
      insertBlockBeside(target.anchorId, target.side, type);
    }
    closeInsertPicker();
  }

  /** И виджет, и готовый макет (§45.6) — уже НЕСКОЛЬКО блоков, а не один,
   * поэтому для них нет аналога `insertBlockBeside`'s обёртки в колонки
   * (см. `website-store.ts`'s комментарий на `insertWidgetBlocks` про то,
   * почему). Для 'beside' здесь сознательно используется тот же
   * sibling-режим, что и для 'sibling' — блоки вставляются сразу ПОСЛЕ
   * анкора в его собственном родителе (то же вычисление parentId/индекса
   * анкора, что `insertBlockBeside` в сторе), не рядом с ним в колонках.
   * Общая для `handleAddWidget`/`handleAddPattern` ниже — разница между
   * ними только в том, откуда берётся массив блоков. */
  function insertBlocksAtTarget(blocks: Parameters<typeof insertWidgetBlocks>[0]) {
    if (target.mode === 'sibling') {
      insertWidgetBlocks(blocks, target.parentId, target.index);
      closeInsertPicker();
      return;
    }

    const page = document?.pages.find((item) => item.id === activePageId);
    const parentId = page ? findParentId(page.blocks, target.anchorId) : undefined;
    if (page && parentId !== undefined) {
      const siblings =
        parentId === null ? page.blocks : (findBlock(page.blocks, parentId)?.children ?? []);
      const anchorIndex = siblings.findIndex((block) => block.id === target.anchorId);
      insertWidgetBlocks(blocks, parentId, anchorIndex === -1 ? siblings.length : anchorIndex + 1);
    }
    closeInsertPicker();
  }

  function handleAddWidget(widget: CustomWidget) {
    insertBlocksAtTarget(widget.schema);
  }

  function handleAddPattern(pattern: LayoutPattern) {
    insertBlocksAtTarget(pattern.build());
  }

  return (
    <Modal onClose={closeInsertPicker} label="Добавить компонент" className={styles.modal}>
      <h2 className={styles.title}>Добавить компонент</h2>
      <ComponentLibraryPanel
        className={styles.library}
        businessId={businessId}
        onAdd={handleAdd}
        onAddWidget={handleAddWidget}
        onAddPattern={handleAddPattern}
        capabilities={capabilities}
      />
    </Modal>
  );
}
