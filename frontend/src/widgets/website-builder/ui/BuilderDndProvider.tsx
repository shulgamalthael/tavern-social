'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';
import {
  findBlock,
  getBlockDefinition,
  isBlockOrDescendant,
  useWebsiteBuilderStore,
  type WebsitePage,
} from '@/entities/website';
import styles from './BuilderDndProvider.module.scss';

interface LibraryDragData {
  kind: 'library';
  blockType: string;
}

interface CanvasBlockDragData {
  kind: 'canvas-block';
  blockType: string;
}

interface EmptyZoneDropData {
  kind: 'empty-zone';
  containerId: string | null;
}

interface SortableSlot {
  containerId: string;
  index: number;
}

/** dnd-kit добавляет это поле сам ко всем `useSortable`-элементам внутри
 * `SortableContext` (см. `SortableList.tsx`) — не наш `data`, а служебное. */
function readSortableSlot(data: Record<string, unknown> | undefined): SortableSlot | null {
  const sortable = data?.sortable as { containerId?: unknown; index?: unknown } | undefined;
  if (!sortable || typeof sortable.containerId !== 'string' || typeof sortable.index !== 'number') {
    return null;
  }
  return { containerId: sortable.containerId, index: sortable.index };
}

export interface BuilderDndProviderProps {
  /** Активная страница — нужна только чтобы найти подпись перетаскиваемого
   * СУЩЕСТВУЮЩЕГО блока канваса для `DragOverlay` (см. `onDragStart`);
   * для нового блока из библиотеки подпись берётся прямо из реестра. */
  page: WebsitePage;
  children: ReactNode;
}

/**
 * Единственный `DndContext` на весь билдер — оборачивает три панели
 * (`ComponentLibraryPanel`, `Canvas`, `InspectorPanel` — см.
 * `WebsiteBuilderWidget.tsx`) одним общим контекстом. Это принципиально: у
 * dnd-kit `useDraggable`/`useDroppable` работают только внутри ОДНОГО
 * общего `DndContext` — если бы он жил внутри `Canvas.tsx` (как было в
 * первой версии), библиотека слева осталась бы вне этого контекста, и
 * перетаскивание нового блока с неё вообще не долетало бы до канваса (баг,
 * найденный сквозной проверкой сценария, не гипотетический).
 *
 * Разбирает `onDragEnd` на два случая: перетаскивание нового блока из
 * библиотеки (`kind: 'library'` → `store.addBlock`) и перемещение уже
 * существующего блока канваса (`kind: 'canvas-block'` → `store.moveBlock`).
 * Целевого родителя и позицию вставки в обоих случаях читает из служебного
 * `data.sortable`, который dnd-kit сам прикладывает к каждому элементу
 * `SortableContext` (см. `SortableList.tsx`, `readSortableSlot`) — либо, при
 * наведении на пустую drop-зону контейнера (`EmptyDropZone.tsx`), из её
 * собственного `data.containerId`.
 */
export function BuilderDndProvider({ page, children }: BuilderDndProviderProps) {
  const addBlock = useWebsiteBuilderStore((state) => state.addBlock);
  const moveBlock = useWebsiteBuilderStore((state) => state.moveBlock);
  const setDragOverTarget = useWebsiteBuilderStore((state) => state.setDragOverTarget);

  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as LibraryDragData | CanvasBlockDragData | undefined;
    if (!data) return;
    if (data.kind === 'library') {
      setDraggedLabel(getBlockDefinition(data.blockType)?.label ?? null);
    } else {
      const block = findBlock(page.blocks, event.active.id as string);
      setDraggedLabel(block ? (getBlockDefinition(block.type)?.label ?? null) : null);
    }
  }

  /** Линия-индикатор «здесь окажется блок, если отпустить сейчас»
   * (`CanvasBlock.tsx`, читает `store.dragOverTarget`) — единственное, чего
   * не хватало в drag-and-drop: раньше единственной обратной связью была
   * плавающая подпись за курсором (`DragOverlay` ниже), без всякого намёка
   * на МЕСТО вставки до самого отпускания. Не трогает пустые drop-зоны
   * (`data.kind === 'empty-zone'`) — та уже подсвечивается сама через
   * `useDroppable`'s `isOver` (`EmptyDropZone.tsx`), второй индикатор поверх
   * был бы лишним. Определяет «до» или «после» цели простым сравнением
   * вертикальных центров перетаскиваемого элемента и цели — тот же приём,
   * которым `verticalListSortingStrategy` сама решает, в какую сторону
   * сдвигать соседей, просто здесь результат ещё и явно показывается
   * пользователю, а не только незаметно участвует в раскладке. */
  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDragOverTarget(null);
      return;
    }

    const activeData = active.data.current as LibraryDragData | CanvasBlockDragData | undefined;

    const overEmptyData = over.data.current as EmptyZoneDropData | undefined;
    if (overEmptyData?.kind === 'empty-zone') {
      setDragOverTarget(null);
      return;
    }

    // Наведение на блок, лежащий внутри поддерева самого перетаскиваемого
    // блока (перетаскиваемый контейнер остаётся смонтированным с `opacity:
    // 0.5`, не скрывается целиком — его собственные потомки остаются
    // валидными целями `closestCenter`) — `moveBlock` такой drop всё равно
    // отклонит (см. её комментарий про `isBlockOrDescendant`), но БЕЗ этой
    // проверки индикатор «сюда встанет блок» всё равно загорелся бы над
    // недопустимой целью, вводя в заблуждение реального пользователя, будто
    // отпускание сработает — живым перетаскиванием подтверждено, что это не
    // только гипотетический сценарий скриптового вызова.
    if (activeData?.kind === 'canvas-block') {
      const moving = findBlock(page.blocks, active.id as string);
      if (moving && isBlockOrDescendant(moving, over.id as string)) {
        setDragOverTarget(null);
        return;
      }
    }

    const activeRect = active.rect.current.translated ?? active.rect.current.initial;
    if (!activeRect) {
      setDragOverTarget(null);
      return;
    }

    const activeCenter = activeRect.top + activeRect.height / 2;
    const overCenter = over.rect.top + over.rect.height / 2;
    setDragOverTarget({
      blockId: over.id as string,
      position: activeCenter < overCenter ? 'before' : 'after',
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggedLabel(null);
    setDragOverTarget(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as LibraryDragData | CanvasBlockDragData | undefined;
    if (!activeData) return;

    const overEmptyData = over.data.current as EmptyZoneDropData | undefined;
    let targetParentId: string | null;
    let targetIndex: number;

    if (overEmptyData?.kind === 'empty-zone') {
      targetParentId = overEmptyData.containerId;
      targetIndex = 0;
    } else {
      const slot = readSortableSlot(over.data.current as Record<string, unknown> | undefined);
      if (!slot) return;
      targetParentId = slot.containerId === 'root' ? null : slot.containerId;
      targetIndex = slot.index;
    }

    if (activeData.kind === 'library') {
      addBlock(activeData.blockType, targetParentId, targetIndex);
    } else if (active.id !== over.id) {
      moveBlock(active.id as string, targetParentId, targetIndex);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDraggedLabel(null);
        setDragOverTarget(null);
      }}
    >
      {children}
      <DragOverlay>
        {draggedLabel ? <div className={styles.overlay}>{draggedLabel}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
