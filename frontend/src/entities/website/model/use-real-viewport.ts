'use client';

import { useMediaQuery } from '@/shared/lib/use-media-query';
import type { Viewport } from './types';

// Те же пороги, что и остальная адаптивная вёрстка сайта
// (`shared/styles/_mixins.scss`, `$bp-mobile: 760px`/`$bp-tablet: 1024px`) —
// один и тот же физический размер экрана должен значить одно и то же и в
// билдере (там — вручную выбранный `store.viewport`), и на реальном
// опубликованном сайте (здесь — по-настоящему, через `matchMedia`).
const TABLET_QUERY = '(max-width: 1023px)';
const MOBILE_QUERY = '(max-width: 759px)';

/**
 * Реальный вьюпорт устройства настоящего посетителя — в отличие от
 * `store.viewport` билдера (переключатель, симулирующий чужой экран внутри
 * фиксированного по ширине холста, не связан с тем, на каком экране открыт
 * сам билдер), нужен везде, где `WebsiteRenderer`/`BlockRenderer` рендерят
 * по-настоящему опубликованный сайт для настоящего браузера
 * (`PublicSiteWidget`, `BusinessPageWidget`) — без него responsive-поля
 * блоков (`heading.size`, `BlockStyle`, скрытие блока по вьюпорту, см.
 * ROADMAP.md §8 Phase 11) были бы не более чем иллюзией внутри билдера:
 * реальный посетитель с телефона до этого исправления в обоих местах
 * получал `viewport="desktop"`, зашитый константой, независимо от размера
 * его настоящего экрана.
 */
export function useRealViewport(): Viewport {
  const isTablet = useMediaQuery(TABLET_QUERY);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}
