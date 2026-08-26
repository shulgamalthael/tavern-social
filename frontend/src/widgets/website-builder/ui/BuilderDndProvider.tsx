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
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';
import {
  findBlock,
  getBlockDefinition,
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

  function onDragEnd(event: DragEndEvent) {
    setDraggedLabel(null);
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
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggedLabel(null)}
    >
      {children}
      <DragOverlay>
        {draggedLabel ? <div className={styles.overlay}>{draggedLabel}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
