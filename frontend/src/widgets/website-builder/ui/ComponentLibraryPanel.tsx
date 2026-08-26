'use client';

import { useDraggable } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import {
  BLOCK_CATEGORY_LABELS,
  BLOCK_CATEGORY_ORDER,
  listVisibleBlockDefinitions,
  useWebsiteBuilderStore,
  type BlockCategory,
  type BlockDefinition,
} from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { SearchIcon } from '@/shared/ui/icons';
import styles from './ComponentLibraryPanel.module.scss';

interface LibraryItemProps {
  definition: BlockDefinition;
  onAdd: (type: string) => void;
}

function LibraryItem({ definition, onAdd }: LibraryItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library:${definition.type}`,
    data: { kind: 'library', blockType: definition.type },
  });
  const Icon = definition.icon;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.item}
      data-dragging={isDragging || undefined}
      title={definition.description}
      onClick={() => onAdd(definition.type)}
      {...listeners}
      {...attributes}
    >
      <span className={styles['item__icon']}>
        <Icon />
      </span>
      {definition.label}
    </button>
  );
}

export interface ComponentLibraryPanelProps {
  className?: string;
  /** По умолчанию клик по компоненту добавляет его в конец активной
   * страницы (см. `onAdd` ниже) — так ведёт себя раскладная панель
   * «Блоки». `AddBlockModal.tsx` переопределяет это на вставку в заранее
   * запомненную позицию (см. `store.insertionTarget`) — та же самая сетка
   * компонентов, другое поведение клика, без дублирования разметки. */
  onAdd?: (type: string) => void;
  /** Капабилити текущего бизнеса (см. `Business.capabilities`) — блоки с
   * `BlockDefinition.capability`, которой здесь нет, не показываются (см.
   * `registry.ts`, комментарий про то, что фильтрация — только здесь, не в
   * самом реестре). По умолчанию пусто — панель показывает только блоки без
   * привязки к капабилити, тот же результат, что и раньше появления этого
   * поля. */
  capabilities?: string[];
}

/**
 * Левая панель билдера — список зарегистрированных блоков (см. `entities/
 * website/model/registry.ts`), сгруппированных по категории. Каждый пункт
 * одновременно и draggable (перетаскивание на канвас, см. `Canvas.tsx`,
 * `onDragEnd`), и обычная кнопка — клик добавляет блок в конец страницы
 * без перетаскивания, для тех, кому это удобнее (см. корневой план фичи,
 * DnD должен быть предсказуем, но не единственным способом).
 */
export function ComponentLibraryPanel({
  className,
  onAdd: onAddOverride,
  capabilities = [],
}: ComponentLibraryPanelProps) {
  const [query, setQuery] = useState('');
  const document = useWebsiteBuilderStore((state) => state.document);
  const activePageId = useWebsiteBuilderStore((state) => state.activePageId);
  const addBlock = useWebsiteBuilderStore((state) => state.addBlock);

  const definitions = useMemo(
    () =>
      listVisibleBlockDefinitions().filter(
        (definition) => !definition.capability || capabilities.includes(definition.capability),
      ),
    [capabilities],
  );

  const grouped = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();
    const filtered = lowerQuery
      ? definitions.filter((definition) => definition.label.toLowerCase().includes(lowerQuery))
      : definitions;

    const map = new Map<BlockCategory, BlockDefinition[]>();
    for (const definition of filtered) {
      const list = map.get(definition.category) ?? [];
      list.push(definition);
      map.set(definition.category, list);
    }
    return map;
  }, [definitions, query]);

  const onAdd =
    onAddOverride ??
    ((type: string) => {
      const page = document?.pages.find((item) => item.id === activePageId);
      addBlock(type, null, page ? page.blocks.length : 0);
    });

  return (
    <div className={cn(styles.panel, className)}>
      <div className={styles.search}>
        <SearchIcon className={styles['search__icon']} />
        <input
          type="search"
          placeholder="Найти компонент…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={styles['search__input']}
        />
      </div>

      <ScrollArea className={styles.scroll} viewportClassName={styles.categories}>
        {BLOCK_CATEGORY_ORDER.map((category) => {
          const items = grouped.get(category);
          if (!items || items.length === 0) return null;

          return (
            <section key={category} className={styles.category}>
              <h3 className={styles['category__title']}>{BLOCK_CATEGORY_LABELS[category]}</h3>
              <div className={styles['category__grid']}>
                {items.map((definition) => (
                  <LibraryItem key={definition.type} definition={definition} onAdd={onAdd} />
                ))}
              </div>
            </section>
          );
        })}
      </ScrollArea>
    </div>
  );
}
