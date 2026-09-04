'use client';

import { useMemo } from 'react';
import {
  buildThemeCssVars,
  GoogleFontLink,
  useWebsiteBuilderStore,
  VIEWPORT_FRAME_WIDTH,
  type BlockBusinessContext,
  type WebsitePage,
  type WebsiteTheme,
} from '@/entities/website';
import { useFitZoom } from '@/shared/lib/use-fit-zoom';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { BlockInsertCross } from './BlockInsertCross';
import { CanvasBlock } from './CanvasBlock';
import { EmptyDropZone } from './EmptyDropZone';
import { SortableList } from './SortableList';
import { ZoomIndicator } from './ZoomIndicator';
import styles from './Canvas.module.scss';

export interface CanvasProps {
  page: WebsitePage;
  /** Все страницы документа, не только рендеримая `page` — см. комментарий
   * `CanvasBlockProps.pages`. */
  pages: WebsitePage[];
  theme: WebsiteTheme;
  business: BlockBusinessContext;
}

/**
 * Чистый рендер канваса — сама координация drag & drop (`DndContext`,
 * сенсоры, `onDragEnd`) живёт на уровень выше, в `WebsiteBuilderWidget.tsx`,
 * а не здесь: `ComponentLibraryPanel` (источник перетаскиваемых блоков) и
 * `Canvas` (место, куда их бросают) — соседние панели одного грид-лейаута,
 * а `useDraggable`/`useDroppable` из dnd-kit работают только внутри ОДНОГО
 * общего `DndContext` — если бы он жил здесь, драг из библиотеки никогда
 * бы не долетал до канваса (ровно так и было при первой версии этого
 * файла, пока баг не нашёлся в сквозной проверке). Здесь остаётся только
 * рендер страницы: рамка вьюпорта, тема через CSS-переменные, дерево
 * блоков через `SortableList`/`CanvasBlock`, пустая drop-зона для пустой
 * страницы.
 */
export function Canvas({ page, pages, theme, business }: CanvasProps) {
  const viewport = useWebsiteBuilderStore((state) => state.viewport);
  const selectEmpty = useWebsiteBuilderStore((state) => state.selectBlock);

  const themeVars = useMemo(() => buildThemeCssVars(theme), [theme]);
  const frameWidth = VIEWPORT_FRAME_WIDTH[viewport];
  const { containerRef, zoom, fitZoom, isFitted, toggleFit } = useFitZoom(frameWidth);

  return (
    <div className={styles.canvasWrap}>
      <ScrollArea
        className={styles.canvasRoot}
        viewportClassName={styles.viewport}
        viewportRef={containerRef}
        onClick={() => selectEmpty(null)}
      >
        <div className={styles.frame} style={{ ...themeVars, width: frameWidth, zoom }}>
          <GoogleFontLink theme={theme} />
          <div className={styles.page} onClick={(event) => event.stopPropagation()}>
            {page.blocks.length > 0 ? (
              <SortableList id="root" items={page.blocks.map((block) => block.id)}>
                {page.blocks.map((block, index) => (
                  <BlockInsertCross key={block.id} blockId={block.id} parentId={null} index={index}>
                    <CanvasBlock
                      block={block}
                      theme={theme}
                      viewport={viewport}
                      business={business}
                      pages={pages}
                    />
                  </BlockInsertCross>
                ))}
              </SortableList>
            ) : (
              <div className={styles.empty}>
                <EmptyDropZone
                  containerId={null}
                  label="Перетащите или нажмите, чтобы добавить первый компонент"
                />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {fitZoom < 0.999 && (
        <ZoomIndicator fitZoom={fitZoom} isFitted={isFitted} onToggle={toggleFit} />
      )}
    </div>
  );
}
