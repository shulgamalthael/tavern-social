'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CartWidget } from '@/entities/cart';
import {
  WebsiteRenderer,
  buildThemeCssVars,
  pageHasHeaderCartButton,
  VIEWPORT_FRAME_WIDTH,
  type BlockBusinessContext,
  type Viewport,
  type WebsitePage,
  type WebsiteTheme,
} from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { useFitZoom } from '@/shared/lib/use-fit-zoom';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { CloseIcon, DesktopIcon, MobileIcon, TabletIcon, type IconProps } from '@/shared/ui/icons';
import { ZoomIndicator } from './ZoomIndicator';
import styles from './PreviewModal.module.scss';

const VIEWPORT_OPTIONS: { value: Viewport; icon: ComponentType<IconProps>; label: string }[] = [
  { value: 'desktop', icon: DesktopIcon, label: 'Десктоп' },
  { value: 'tablet', icon: TabletIcon, label: 'Планшет' },
  { value: 'mobile', icon: MobileIcon, label: 'Телефон' },
];

export interface PreviewModalProps {
  page: WebsitePage;
  /** Все страницы документа — так ссылки на другие страницы сайта (`control:
   * 'link'`, см. `resolve-link.ts`) резолвятся в реальный путь и здесь тоже,
   * не только на публичной странице/канвасе билдера. */
  pages: WebsitePage[];
  theme: WebsiteTheme;
  business: BlockBusinessContext;
  onClose: () => void;
}

/**
 * Просмотр черновика поверх билдера — намеренно свой портал/overlay, а не
 * обёртка над `shared/ui/Modal` (тому нужна фиксированная маленькая карточка
 * для форм, а тут — почти полноэкранный фрейм сайта со своим переключателем
 * вьюпорта). Рендерит `WebsiteRenderer` — тот же компонент, что публичная
 * страница `/business/[id]` (см. корневой план фичи: «Preview должен
 * использовать тот же renderer, что публикация») — поэтому то, что видно
 * здесь, один в один совпадает с тем, что увидят посетители после публикации.
 */
export function PreviewModal({ page, pages, theme, business, onClose }: PreviewModalProps) {
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const frameWidth = VIEWPORT_FRAME_WIDTH[viewport];
  const { containerRef, zoom, fitZoom, isFitted, toggleFit } = useFitZoom(frameWidth);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Просмотр сайта">
      <div className={styles.bar}>
        <p className={styles.bar__title}>Просмотр — {business.name}</p>

        <div className={styles.switcher}>
          {VIEWPORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              title={option.label}
              className={cn(
                styles.switcher__item,
                viewport === option.value && styles['switcher__item--active'],
              )}
              onClick={() => setViewport(option.value)}
            >
              <option.icon />
            </button>
          ))}
        </div>

        <button
          type="button"
          className={styles.close}
          aria-label="Закрыть просмотр"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className={styles.bodyWrap}>
        <ScrollArea
          className={styles.body}
          viewportClassName={styles.bodyViewport}
          viewportRef={containerRef}
        >
          <div
            className={styles.frame}
            style={{ ...buildThemeCssVars(theme), width: frameWidth, zoom }}
          >
            <WebsiteRenderer
              page={page}
              pages={pages}
              theme={theme}
              viewport={viewport}
              business={business}
            />
          </div>
        </ScrollArea>

        {fitZoom < 0.999 && (
          <ZoomIndicator fitZoom={fitZoom} isFitted={isFitted} onToggle={toggleFit} />
        )}
      </div>

      {/* Кнопка «Корзина» в шапке (`HeaderActions.tsx`) реально открывает
       * `useCartStore`'s панель — без своего `<CartWidget>` здесь клик по
       * ней в Preview был бы тихим no-op (стор поменялся, показывать некому).
       * `hideFab` всегда true — свой плавающий `.fab` тут не нужен, кнопка
       * уже есть в шапке (иначе `pageHasHeaderCartButton` не пропустила бы
       * этот блок сюда). */}
      {pageHasHeaderCartButton(page.blocks) && (
        <CartWidget businessId={business.businessId} hideFab />
      )}
    </div>,
    document.body,
  );
}
