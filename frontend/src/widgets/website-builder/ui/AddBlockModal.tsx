'use client';

import { useWebsiteBuilderStore } from '@/entities/website';
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
  /** Прокидывается напрямую в `ComponentLibraryPanel` — см. её комментарий. */
  capabilities?: string[];
}

export function AddBlockModal({ capabilities }: AddBlockModalProps) {
  const insertionTarget = useWebsiteBuilderStore((state) => state.insertionTarget);
  const addBlock = useWebsiteBuilderStore((state) => state.addBlock);
  const insertBlockBeside = useWebsiteBuilderStore((state) => state.insertBlockBeside);
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

  return (
    <Modal onClose={closeInsertPicker} label="Добавить компонент" className={styles.modal}>
      <h2 className={styles.title}>Добавить компонент</h2>
      <ComponentLibraryPanel
        className={styles.library}
        onAdd={handleAdd}
        capabilities={capabilities}
      />
    </Modal>
  );
}
