'use client';

import { useDraggable } from '@dnd-kit/core';
import { useCallback, useMemo, useState } from 'react';
import {
  BLOCK_CATEGORY_LABELS,
  BLOCK_CATEGORY_ORDER,
  BlockThumbnail,
  LAYOUT_PATTERNS,
  LayoutPatternThumbnail,
  listVisibleBlockDefinitions,
  useWebsiteBuilderStore,
  type BlockCategory,
  type BlockDefinition,
  type LayoutPattern,
} from '@/entities/website';
import { getCustomWidgets, type CustomWidget } from '@/entities/custom-widget';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { GridIcon, SearchIcon } from '@/shared/ui/icons';
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

  return (
    // Не `<button>` — `BlockThumbnail` живьём рендерит сам блок (§Фаза 2), а
    // у некоторых блоков внутри есть свои интерактивные элементы (например,
    // `<button>` раскрытия вопроса у `faq`) — вложенный `<button>` внутри
    // `<button>` недопустим в HTML и ловится React как ошибка гидратации.
    // `role="button"` + свой `onKeyDown` дают ту же доступность с клавиатуры,
    // что была у настоящей кнопки, без структурного конфликта.
    <div
      ref={setNodeRef}
      className={styles.item}
      data-dragging={isDragging || undefined}
      title={definition.description}
      onClick={() => onAdd(definition.type)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAdd(definition.type);
        }
      }}
      {...listeners}
      {...attributes}
    >
      <BlockThumbnail definition={definition} />
      <span className={styles['item__label']}>{definition.label}</span>
    </div>
  );
}

interface LayoutPatternItemProps {
  pattern: LayoutPattern;
  onAdd: (pattern: LayoutPattern) => void;
}

/** Готовый составленный макет (§45.6 плана — «сайдбар/две-три колонки одним
 * кликом» вместо ручной сборки section→columns→column) — карточка того же
 * вида, что и у обычного блока, просто превью — целое дерево
 * (`LayoutPatternThumbnail`), а клик вставляет НЕСКОЛЬКО блоков разом
 * (`insertWidgetBlocks`, тот же путь, что и у «Моих виджетов» ниже). `<div
 * role="button">`, не `<button>` — та же причина, что у `LibraryItem`: живой
 * превью-рендер внутри может содержать что угодно, включая чужие
 * интерактивные элементы. */
function LayoutPatternItem({ pattern, onAdd }: LayoutPatternItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.item}
      title={pattern.description}
      onClick={() => onAdd(pattern)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAdd(pattern);
        }
      }}
    >
      <LayoutPatternThumbnail pattern={pattern} />
      <span className={styles['item__label']}>{pattern.label}</span>
    </div>
  );
}

interface WidgetLibraryItemProps {
  widget: CustomWidget;
  onAdd: (widget: CustomWidget) => void;
}

/** В отличие от `LibraryItem`, НЕ draggable (§16.2's own scope note) —
 * перетаскивание виджета на канвас потребовало бы учить `Canvas.tsx`'s
 * `onDragEnd` новому виду drag-payload'а (`kind: 'widget'` вместо `'library'`,
 * вставка НЕСКОЛЬКИХ блоков вместо одного) — реальная, отдельная работа,
 * сознательно отложенная до появления запроса на неё; клик уже даёт
 * полноценный способ вставить виджет. */
function WidgetLibraryItem({ widget, onAdd }: WidgetLibraryItemProps) {
  return (
    <button
      type="button"
      className={styles.item}
      title={`${widget.schema.length} блок(ов)`}
      onClick={() => onAdd(widget)}
    >
      <span className={styles['item__icon']}>
        <GridIcon />
      </span>
      {widget.name}
    </button>
  );
}

export interface ComponentLibraryPanelProps {
  className?: string;
  /** Нужен, чтобы подгрузить сохранённые виджеты бизнеса (см. секцию
   * «Мои виджеты» ниже, §16.2) — сам реестр стандартных блоков от бизнеса
   * не зависит. */
  businessId: string;
  /** По умолчанию клик по компоненту добавляет его в конец активной
   * страницы (см. `onAdd` ниже) — так ведёт себя раскладная панель
   * «Блоки». `AddBlockModal.tsx` переопределяет это на вставку в заранее
   * запомненную позицию (см. `store.insertionTarget`) — та же самая сетка
   * компонентов, другое поведение клика, без дублирования разметки. */
  onAdd?: (type: string) => void;
  /** Тот же приём override, что `onAdd`, но для секции «Мои виджеты» (§16.2)
   * — отдельный колбэк, а не перегрузка `onAdd` одной строкой типа, потому
   * что вставка виджета вставляет НЕСКОЛЬКО блоков сразу
   * (`insertWidgetBlocks`), не один (`addBlock`). */
  onAddWidget?: (widget: CustomWidget) => void;
  /** Тот же приём override, что `onAddWidget` — вставка готового макета
   * (§45.6) тоже вставляет НЕСКОЛЬКО блоков разом (`insertWidgetBlocks`),
   * не один. */
  onAddPattern?: (pattern: LayoutPattern) => void;
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
 *
 * Секция «Мои виджеты» (Custom Widget Engine, AI_PLATFORM_ROADMAP.md §2.4/
 * §14/§16.2) добавлена под тем же поиском — первое реальное встраивание
 * сохранённых виджетов в страницу (§14 сознательно отгрузил только
 * сохранение, без встраивания). Скрыта целиком, пока список не загружен
 * успешно и не пуст — виджеты необязательны, не стоит показывать пустую
 * секцию или лишний спиннер ради опциональной функции, но реальная ошибка
 * загрузки всё равно показывается явно (раздел 4 `frontend/AGENTS.md`),
 * не проглатывается молча.
 */
export function ComponentLibraryPanel({
  className,
  businessId,
  onAdd: onAddOverride,
  onAddWidget: onAddWidgetOverride,
  onAddPattern: onAddPatternOverride,
  capabilities = [],
}: ComponentLibraryPanelProps) {
  const [query, setQuery] = useState('');
  const document = useWebsiteBuilderStore((state) => state.document);
  const activePageId = useWebsiteBuilderStore((state) => state.activePageId);
  const addBlock = useWebsiteBuilderStore((state) => state.addBlock);
  const insertWidgetBlocks = useWebsiteBuilderStore((state) => state.insertWidgetBlocks);

  const widgetsFetcher = useCallback(() => getCustomWidgets(businessId), [businessId]);
  const widgets = useAsyncData(widgetsFetcher);

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

  const onAddWidget =
    onAddWidgetOverride ??
    ((widget: CustomWidget) => {
      const page = document?.pages.find((item) => item.id === activePageId);
      insertWidgetBlocks(widget.schema, null, page ? page.blocks.length : 0);
    });

  const onAddPattern =
    onAddPatternOverride ??
    ((pattern: LayoutPattern) => {
      const page = document?.pages.find((item) => item.id === activePageId);
      insertWidgetBlocks(pattern.build(), null, page ? page.blocks.length : 0);
    });

  const lowerQuery = query.trim().toLowerCase();
  const visiblePatterns = lowerQuery
    ? LAYOUT_PATTERNS.filter((pattern) => pattern.label.toLowerCase().includes(lowerQuery))
    : LAYOUT_PATTERNS;

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
        {visiblePatterns.length > 0 && (
          <section className={styles.category}>
            <h3 className={styles['category__title']}>Готовые макеты</h3>
            <div className={styles['category__grid']}>
              {visiblePatterns.map((pattern) => (
                <LayoutPatternItem key={pattern.id} pattern={pattern} onAdd={onAddPattern} />
              ))}
            </div>
          </section>
        )}
        {widgets.status === 'error' && (
          <section className={styles.category}>
            <h3 className={styles['category__title']}>Мои виджеты</h3>
            <p className={styles.error}>Не удалось загрузить виджеты</p>
          </section>
        )}
        {widgets.status === 'success' && widgets.data && widgets.data.length > 0 && (
          <section className={styles.category}>
            <h3 className={styles['category__title']}>Мои виджеты</h3>
            <div className={styles['category__grid']}>
              {widgets.data.map((widget) => (
                <WidgetLibraryItem key={widget.id} widget={widget} onAdd={onAddWidget} />
              ))}
            </div>
          </section>
        )}
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
