'use client';

import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import {
  getSelectedAd,
  recordAdClick,
  recordAdImpression,
  type AdFormat,
  type AdPlacement,
  type SelectedAd,
} from '@/entities/advertising';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { MegaphoneIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import styles from './advertising.module.scss';

// --- AdSlot --------------------------------------------------------------
// Единственный рекламный блок Builder'а (корневой план фичи §6) — владелец
// сайта настраивает ТОЛЬКО `placement` (где на странице стоит слот), ни
// креатив, ни размеры/форматы здесь не редактируются: это и есть "Platform
// managed" (посетитель сайта не должен уметь принять чужую рекламу за
// собственный контент владельца, а владелец — подменить содержимое чужой
// оплаченной кампании). Сколько таких блоков вообще можно разместить на
// сайте — решает не этот блок, а `AdvertisingInventoryService` на backend
// (см. её комментарий), гейт применяется в `ComponentLibraryPanel`, не
// здесь: уже размещённый слот продолжает работать, даже если тариф бизнеса
// потом понизили (тот же принцип, что и у `BlockDefinition.capability`).

/**
 * Зафиксированные (не диапазон) ширина/высота на placement — конкретный
 * компромисс ради Core Web Vitals (план фичи, «Layout Shift/CLS»): контейнер
 * резервирует РОВНО эту высоту ещё ДО того, как известно, найдётся ли
 * подходящая кампания — состояния loading/creative/empty занимают одну и ту
 * же высоту, сайту never нужно знать реальные пиксели креатива заранее.
 * `allowedFormats` — независимая frontend-копия того же контракта, что и
 * backend `AD_PLACEMENT_ALLOWED_FORMATS` (`modules/advertising/lib/ad-
 * placement-config.ts`) — используется только для показа владельцу, какие
 * форматы креатива в принципе может занять этот placement, backend всё
 * равно фильтрует независимо на выдаче.
 */
// `feed_sidebar` намеренно исключён — это не место на САЙТЕ бизнеса, а
// сайдбар ленты самой Таверны (см. backend `AdPlacement`'s комментарий в
// schema.prisma), владелец сайта не может разместить туда свой блок.
type SiteAdPlacement = Exclude<AdPlacement, 'feed_sidebar'>;

export const AD_PLACEMENT_CONFIG: Record<
  SiteAdPlacement,
  { label: string; allowedFormats: AdFormat[]; width: number; height: number }
> = {
  header: { label: 'Шапка', allowedFormats: ['banner', 'mobile_banner'], width: 728, height: 90 },
  content: {
    label: 'В контенте',
    allowedFormats: ['banner', 'large_banner', 'rectangle', 'native', 'card', 'video'],
    width: 970,
    height: 250,
  },
  sidebar: {
    // `card` добавлен для карточки товара (`AdCampaignsService.
    // addCreative`'s `productId`-ветка, всегда `format: 'card'`, 300×120)
    // — та же правка, синхронно зеркалящая backend `AD_PLACEMENT_ALLOWED_
    // FORMATS` (см. её комментарий там же); card уже и ниже этой коробки,
    // лишнее место остаётся пустым, как и у `square`.
    label: 'Сайдбар',
    allowedFormats: ['rectangle', 'square', 'card'],
    width: 300,
    height: 250,
  },
  footer: { label: 'Подвал', allowedFormats: ['banner', 'mobile_banner'], width: 728, height: 90 },
  in_feed: {
    label: 'В ленте',
    allowedFormats: ['native', 'card', 'square', 'video'],
    width: 600,
    height: 300,
  },
};

interface AdSlotProps {
  placement: SiteAdPlacement;
}

function AdSlotRenderer({ props, business, viewport, isEditing }: BlockRendererProps<AdSlotProps>) {
  const config = AD_PLACEMENT_CONFIG[props.placement];
  const slotStyle = {
    '--slot-width': `${config.width}px`,
    '--slot-height': `${config.height}px`,
  } as CSSProperties;

  // В билдере рендерер НИКОГДА не запрашивает и не показывает реальный
  // креатив (см. комментарий блока выше) — вместо условного вызова хука
  // (нарушил бы Rules of Hooks) фетчер сам резолвится в `null` без сетевого
  // запроса, пока `isEditing` истинно.
  const fetcher = useCallback(
    () =>
      isEditing
        ? Promise.resolve(null)
        : getSelectedAd(business.businessId, props.placement, viewport),
    [isEditing, business.businessId, props.placement, viewport],
  );
  const { status, data } = useAsyncData<SelectedAd | null>(fetcher);

  const impressionFiredForRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEditing || status !== 'success' || !data) return;
    if (impressionFiredForRef.current === data.creativeId) return;
    impressionFiredForRef.current = data.creativeId;
    void recordAdImpression(business.businessId, {
      campaignId: data.campaignId,
      creativeId: data.creativeId,
      placement: props.placement,
    });
  }, [isEditing, status, data, business.businessId, props.placement]);

  if (isEditing) {
    return (
      <div className={`${styles.slot} ${styles['slot--builder']}`} style={slotStyle}>
        <MegaphoneIcon />
        <span className={styles.slot__label}>Рекламный слот — управляется платформой</span>
        <span className={styles.slot__placement}>{config.label}</span>
      </div>
    );
  }

  if (status !== 'success' || !data) {
    // И `loading`, и честно пустой результат (нет подходящей кампании)
    // занимают одну и ту же зарезервированную высоту — см. комментарий
    // блока `AD_PLACEMENT_CONFIG` про CLS.
    return <div className={`${styles.slot} ${styles['slot--empty']}`} style={slotStyle} />;
  }

  function handleClick() {
    if (!data) return;
    void recordAdClick(business.businessId, {
      campaignId: data.campaignId,
      creativeId: data.creativeId,
      placement: props.placement,
    });
  }

  return (
    <div className={styles.slot} style={slotStyle}>
      <a
        href={data.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={styles['creative__link']}
        onClick={handleClick}
      >
        {data.videoUrl ? (
          // Автоплей видео-креатива без звука/жеста пользователя — стандартное
          // поведение видеорекламы в ленте (тот же приём, что у большинства
          // сетей), `muted` обязателен: браузеры блокируют автоплей со звуком
          // без взаимодействия пользователя. `loop` — короткий рекламный ролик
          // не должен молча замирать на последнем кадре до следующего показа.
          <video
            src={data.videoUrl}
            className={styles['creative__image']}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- креатив рекламодателя, произвольный домен медиа-хранилища
          <img src={data.imageUrl} alt={data.headline} className={styles['creative__image']} />
        ) : (
          <div className={styles['creative__body']}>
            <p className={styles['creative__headline']}>{data.headline}</p>
            {data.description && (
              <p className={styles['creative__description']}>{data.description}</p>
            )}
            {data.ctaLabel && <span className={styles['creative__cta']}>{data.ctaLabel}</span>}
          </div>
        )}
      </a>
      <span className={styles['creative__sponsored']}>Реклама</span>
    </div>
  );
}

const adSlotFields: FieldSchema[] = [
  {
    key: 'placement',
    label: 'Место размещения',
    control: 'select',
    options: (Object.keys(AD_PLACEMENT_CONFIG) as SiteAdPlacement[]).map((placement) => ({
      value: placement,
      label: AD_PLACEMENT_CONFIG[placement].label,
    })),
  },
];

registerBlock<AdSlotProps>({
  type: 'adslot',
  label: 'Рекламный слот',
  category: 'advertising',
  icon: MegaphoneIcon,
  description: 'Слот платформенной рекламы — количество определяется тарифом бизнеса',
  defaultProps: { placement: 'content' },
  fields: adSlotFields,
  Renderer: AdSlotRenderer,
});
