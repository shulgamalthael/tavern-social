import type { AdFormat } from '@/entities/advertising';

/**
 * Канонический размер превью на КАЖДЫЙ формат креатива — авторский
 * (dashboard-only) вспомогательный конфиг, НЕ то же самое, что `AD_PLACEMENT_
 * CONFIG` (`entities/website/blocks/advertising`): тот привязан к МЕСТУ
 * размещения на сайте (нужен для резервирования CLS-safe высоты блока на
 * реальной странице), этот — к самому ФОРМАТУ креатива, безотносительно
 * того, куда его в итоге поставят (владелец выбирает формат здесь, ещё до
 * того, как какой-либо сайт-паблишер вообще подберёт этот креатив под свой
 * placement). Используется для двух вещей сразу из одного источника:
 * пропорции превью-карточки (`AdCreativePreview`) И `aspect` кроппера
 * (`AdCreativeMediaField`) — выбор формата должен согласованно менять и то,
 * и другое.
 *
 * Значения — узнаваемые IAB-подобные размеры (то, что реально принято
 * индустрией для баннеров), кроме `native`/`card`/`video`, у которых нет
 * единого стандартного размера — взяты разумные карточные пропорции.
 */
export const AD_FORMAT_PREVIEW_CONFIG: Record<AdFormat, { width: number; height: number }> = {
  banner: { width: 728, height: 90 },
  large_banner: { width: 970, height: 250 },
  rectangle: { width: 300, height: 250 },
  square: { width: 250, height: 250 },
  mobile_banner: { width: 320, height: 50 },
  native: { width: 300, height: 100 },
  card: { width: 300, height: 120 },
  video: { width: 300, height: 250 },
};
