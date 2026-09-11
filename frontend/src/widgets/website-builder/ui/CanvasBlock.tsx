'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type BlockBusinessContext,
  computeBlockWrapperStyle,
  getBlockDefinition,
  isBlockHidden,
  useWebsiteBuilderStore,
  type Viewport,
  type WebsiteBlock,
  type WebsitePage,
  type WebsiteTheme,
} from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import {
  DuplicateIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  GripIcon,
  TrashIcon,
} from '@/shared/ui/icons';
import { BlockInsertCross } from './BlockInsertCross';
import { EmptyDropZone } from './EmptyDropZone';
import { SortableList } from './SortableList';
import styles from './CanvasBlock.module.scss';

export interface CanvasBlockProps {
  block: WebsiteBlock;
  theme: WebsiteTheme;
  viewport: Viewport;
  business: BlockBusinessContext;
  /** Все страницы документа — для блоков с полем-ссылкой на другую страницу
   * сайта (`control: 'link'`, см. `entities/website/model/resolve-link.ts`).
   */
  pages: WebsitePage[];
}

/**
 * Один блок на канвасе билдера — тот же `getBlockDefinition`/
 * `computeBlockWrapperStyle`, что и публичный `BlockRenderer` (см.
 * `entities/website/ui/BlockRenderer.tsx`), но с редакторским хромом
 * поверх: drag-хендл, тулбар при наведении/выделении (дублировать/скрыть/
 * удалить), клик — выделение. Контейнерные блоки рекурсивно рендерят своих
 * детей через `SortableList`, с пустой drop-зоной, если детей ещё нет.
 */
export function CanvasBlock({ block, theme, viewport, business, pages }: CanvasBlockProps) {
  const definition = getBlockDefinition(block.type);
  const selectedBlockId = useWebsiteBuilderStore((state) => state.selectedBlockId);
  const selectBlock = useWebsiteBuilderStore((state) => state.selectBlock);
  const removeBlock = useWebsiteBuilderStore((state) => state.removeBlock);
  const duplicateBlock = useWebsiteBuilderStore((state) => state.duplicateBlock);
  const toggleBlockVisibility = useWebsiteBuilderStore((state) => state.toggleBlockVisibility);
  const updateBlockProps = useWebsiteBuilderStore((state) => state.updateBlockProps);
  // Точечный селектор — возвращает значение, ОТНОСЯЩЕЕСЯ ИМЕННО К ЭТОМУ
  // блоку, не всё поле стора целиком: `onDragOver` в `BuilderDndProvider.tsx`
  // срабатывает часто (на каждое перемещение курсора), а перерендериться из-
  // за этого должны только два блока — тот, что был целью до этого тика, и
  // тот, что стал ею сейчас, не вообще все блоки страницы.
  const dropPosition = useWebsiteBuilderStore((state) =>
    state.dragOverTarget?.blockId === block.id ? state.dragOverTarget.position : null,
  );

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { kind: 'canvas-block', blockType: block.type },
  });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Неизвестный `block.type` — старый документ после удаления/переименования
  // типа блока в реестре, или битые данные. Раньше здесь было `return null`:
  // блок молча пропадал с холста без всякого следа, и было невозможно понять,
  // что вообще случилось с содержимым страницы. Явный фолбэк с возможностью
  // удалить — контролируемое состояние вместо необъяснимой пропажи.
  if (!definition) {
    return (
      <div
        ref={setNodeRef}
        style={dragStyle}
        className={cn(styles.block, styles['block--unsupported'])}
      >
        <span className={styles['unsupported__label']}>Неизвестный тип блока «{block.type}»</span>
        <button
          type="button"
          className={styles['unsupported__delete']}
          aria-label="Удалить неподдерживаемый блок"
          onClick={(event) => {
            event.stopPropagation();
            removeBlock(block.id);
          }}
        >
          <TrashIcon />
        </button>
      </div>
    );
  }

  const hidden = isBlockHidden(block, viewport);
  const isSelected = selectedBlockId === block.id;
  const { outer, inner, layout } = computeBlockWrapperStyle(block.style, viewport);
  const Renderer = definition.Renderer;

  return (
    <div
      ref={setNodeRef}
      style={{ ...outer, ...dragStyle }}
      className={cn(
        styles.block,
        isSelected && styles['block--selected'],
        hidden && styles['block--hidden'],
        isDragging && styles['block--dragging'],
      )}
      onClick={(event) => {
        event.stopPropagation();
        selectBlock(block.id);
      }}
    >
      {dropPosition && (
        <div
          className={cn(
            styles['block__dropIndicator'],
            styles[`block__dropIndicator--${dropPosition}`],
          )}
          aria-hidden="true"
        />
      )}

      <div className={styles['block__toolbar']}>
        <button
          type="button"
          className={styles['block__grip']}
          aria-label="Перетащить"
          {...listeners}
          {...attributes}
        >
          <GripIcon />
        </button>
        <span className={styles['block__label']}>{definition.label}</span>
        <span className={styles['block__actions']}>
          <button
            type="button"
            className={styles['block__action']}
            aria-label="Редактировать блок"
            title="Редактировать"
            onClick={(event) => {
              event.stopPropagation();
              selectBlock(block.id);
            }}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className={styles['block__action']}
            aria-label={hidden ? `Показать на ${viewport}` : `Скрыть на ${viewport}`}
            title={hidden ? 'Скрыт на этом экране — показать' : 'Скрыть на этом экране'}
            onClick={(event) => {
              event.stopPropagation();
              toggleBlockVisibility(block.id, viewport);
            }}
          >
            {hidden ? <EyeOffIcon /> : <EyeIcon />}
          </button>
          <button
            type="button"
            className={styles['block__action']}
            aria-label="Дублировать блок"
            title="Дублировать"
            onClick={(event) => {
              event.stopPropagation();
              duplicateBlock(block.id);
            }}
          >
            <DuplicateIcon />
          </button>
          <button
            type="button"
            className={cn(styles['block__action'], styles['block__action--danger'])}
            aria-label="Удалить блок"
            title="Удалить"
            onClick={(event) => {
              event.stopPropagation();
              removeBlock(block.id);
            }}
          >
            <TrashIcon />
          </button>
        </span>
      </div>

      <div
        style={inner}
        className={styles['block__content']}
        // Реальный `<a href>` внутри отрендеренного блока (кнопка/ссылка —
        // `SiteButton` и т. п.) не должен по-настоящему переходить по
        // ссылке внутри канваса билдера — иначе первый клик по editable-
        // тексту кнопки (§67) увёл бы со страницы билдера вместо входа в
        // редактирование. Только `preventDefault` в capture-фазе, БЕЗ
        // `stopPropagation` — событие клика всё равно доходит до
        // `EditableText`'s собственного bubble-фазного `onClick` (тому не
        // нужно настоящее действие ссылки, только сам факт клика).
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('a')) {
            event.preventDefault();
          }
        }}
      >
        <Renderer
          props={block.props}
          theme={theme}
          viewport={viewport}
          business={business}
          pages={pages}
          layout={layout}
          isEditing
          onEditProp={(key, value) => updateBlockProps(block.id, { [key]: value })}
        >
          {definition.isContainer &&
            (block.children && block.children.length > 0 ? (
              <SortableList id={block.id} items={block.children.map((child) => child.id)}>
                {block.children.map((child, index) => (
                  <BlockInsertCross
                    key={child.id}
                    blockId={child.id}
                    parentId={block.id}
                    index={index}
                  >
                    <CanvasBlock
                      block={child}
                      theme={theme}
                      viewport={viewport}
                      business={business}
                      pages={pages}
                    />
                  </BlockInsertCross>
                ))}
              </SortableList>
            ) : (
              <EmptyDropZone containerId={block.id} />
            ))}
        </Renderer>
      </div>
    </div>
  );
}
