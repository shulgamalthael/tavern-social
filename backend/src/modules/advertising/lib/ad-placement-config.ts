import type { AdFormat, AdPlacement } from '@prisma/client';

/**
 * Независимая backend-копия того же контракта, что и frontend'овый
 * `AD_PLACEMENT_CONFIG` (`entities/website/blocks/advertising/index.tsx`) —
 * тот же приём, что `add-block-schemas.ts` держит свою копию полей блоков
 * отдельно от frontend-реестра (backend не импортирует frontend-код). Здесь
 * используется только для одной вещи: какие форматы креатива физически
 * помещаются в данное место размещения (`AdEngineService.selectCreative`
 * отбрасывает креативы неподходящего формата) — размеры в пикселях те же,
 * что и во frontend-версии, менять оба места синхронно при правке.
 */
export const AD_PLACEMENT_ALLOWED_FORMATS: Record<AdPlacement, readonly AdFormat[]> = {
  header: ['banner', 'mobile_banner'],
  // `video` — только здесь и в `in_feed`: оба места достаточно крупные
  // (см. frontend `AD_PLACEMENT_CONFIG`'s `width`/`height` для `content`/
  // `in_feed`), `header`/`footer`/`sidebar` слишком узкие/низкие для
  // видео-креатива физически.
  content: ['banner', 'large_banner', 'rectangle', 'native', 'card', 'video'],
  sidebar: ['rectangle', 'square'],
  footer: ['banner', 'mobile_banner'],
  in_feed: ['native', 'card', 'square', 'video'],
  // Та же физическая ширина колонки, что и у `sidebar` (сайдбар сайта
  // бизнеса) — тот же набор форматов вписывается без отдельного расчёта.
  feed_sidebar: ['rectangle', 'square'],
};
