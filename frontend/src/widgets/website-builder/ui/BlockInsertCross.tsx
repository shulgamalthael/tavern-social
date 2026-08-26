'use client';

import type { ReactNode } from 'react';
import { useWebsiteBuilderStore } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { PlusIcon } from '@/shared/ui/icons';
import styles from './BlockInsertCross.module.scss';

export interface BlockInsertCrossProps {
  blockId: string;
  /** Родитель блока в дереве (`null` — верхний уровень страницы) и его
   * позиция в списке детей этого родителя — верх/низ вставляют в тот же
   * список, на `index`/`index + 1` (см. `store.openInsertPicker`). */
  parentId: string | null;
  index: number;
  children: ReactNode;
}

/**
 * Крест из четырёх зон вокруг блока — сверху/снизу/слева/справа (см.
 * корневой план задачи: «делаем крест»). Сверху/снизу вставляют СОСЕДА в тот
 * же список (`store.openInsertPicker`) — на странице блоки и так стоят друг
 * под другом, там есть куда встать рядом. Слева/справа вставить в тот же
 * список физически некуда (список всего один, вертикальный), поэтому клик
 * там оборачивает анкор и новый блок в общий `columns`
 * (`store.openInsertPickerBeside` → `insertBlockBeside`) — тот же результат,
 * что и «обёртка в колонки» в Notion/Framer/Webflow.
 *
 * Видимость кнопок — как у тулбара блока (`CanvasBlock.module.scss`,
 * `.block:hover, .block--selected`): на десктопе — наведение на любую точку
 * креста (сам блок или любую из четырёх зон) сразу показывает все четыре;
 * на телефоне/планшете наведения нет, поэтому крест показывается только у
 * ВЫБРАННОГО блока. Показывать его сразу у КАЖДОГО блока на КАЖДОМ уровне
 * вложенности одновременно (первая версия этой фичи) при вложенных узких
 * колонках превращалось в частокол одинаковых кружков на каждой границе —
 * выбор перед этим лишний тап, но он и так почти всегда нужен, чтобы
 * открыть настройки блока, так что не добавляет отдельного шага. Едва
 * заметная линия на месте каждой зоны (см. module.scss) остаётся видна
 * всегда — сам факт «сюда можно что-то добавить» не требует выбора, только
 * сама кнопка требует.
 *
 * Один и тот же компонент оборачивает и блоки верхнего уровня страницы
 * (`Canvas.tsx`), и вложенные дети любого контейнера (`CanvasBlock.tsx`).
 */
export function BlockInsertCross({ blockId, parentId, index, children }: BlockInsertCrossProps) {
  const openInsertPicker = useWebsiteBuilderStore((state) => state.openInsertPicker);
  const openInsertPickerBeside = useWebsiteBuilderStore((state) => state.openInsertPickerBeside);
  const isSelected = useWebsiteBuilderStore((state) => state.selectedBlockId === blockId);

  function stop(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  return (
    <div className={cn(styles.cross, isSelected && styles['cross--selected'])}>
      <div className={cn(styles.zone, styles['zone--horizontal'])}>
        <button
          type="button"
          className={styles.button}
          aria-label="Добавить блок сверху"
          onClick={(event) => {
            stop(event);
            openInsertPicker(parentId, index);
          }}
        >
          <PlusIcon />
        </button>
      </div>

      <div className={styles.cross__middle}>
        <div className={cn(styles.zone, styles['zone--vertical'])}>
          <button
            type="button"
            className={styles.button}
            aria-label="Добавить блок слева"
            onClick={(event) => {
              stop(event);
              openInsertPickerBeside(blockId, 'left');
            }}
          >
            <PlusIcon />
          </button>
        </div>

        <div className={styles['cross__block']}>{children}</div>

        <div className={cn(styles.zone, styles['zone--vertical'])}>
          <button
            type="button"
            className={styles.button}
            aria-label="Добавить блок справа"
            onClick={(event) => {
              stop(event);
              openInsertPickerBeside(blockId, 'right');
            }}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className={cn(styles.zone, styles['zone--horizontal'])}>
        <button
          type="button"
          className={styles.button}
          aria-label="Добавить блок снизу"
          onClick={(event) => {
            stop(event);
            openInsertPicker(parentId, index + 1);
          }}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}
