'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { BookingModal } from '@/entities/appointment';
import { FavoriteButton, useFavoriteStore } from '@/entities/favorite';
import { getPublicServices, formatDuration, type PublicService } from '@/entities/service';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { CalendarIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import type { DataSourceValue } from '../../model/types';
import { SectionHeading } from '../shared/SectionHeading';
import primitives from '../shared/primitives.module.scss';
import styles from './booking.module.scss';

// --- ServiceGrid ---------------------------------------------------------
// Зеркало `productgrid` (Commerce, см. `blocks/commerce/index.tsx`) для
// Booking — тот же data-driven паттерн (`dataSource`, см. `DataSourceValue`
// в `model/types.ts`), своя карточка с кнопкой «Записаться» вместо «В
// корзину»: у записи нет понятия корзины (см. `BookingModal` в `entities/
// appointment/ui`), клик сразу открывает форму записи на эту услугу.

interface ServiceGridProps {
  eyebrow: string;
  heading: string;
  description: string;
  dataSource: DataSourceValue;
  columns: number;
}

function sortServices(services: PublicService[], sort: DataSourceValue['sort']): PublicService[] {
  const sorted = [...services];
  if (sort === 'price-asc') sorted.sort((a, b) => a.priceCents - b.priceCents);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.priceCents - a.priceCents);
  // 'newest' — уже порядок `listPublic` на backend, см. `productgrid`.
  return sorted;
}

interface ServiceCardProps {
  service: PublicService;
  businessId: string;
  /** См. `BlockRendererProps.isEditing` — внутри билдера кнопка не должна
   * реально открывать форму записи, тот же принцип, что и у `ProductCard`
   * в `blocks/commerce`. */
  isEditing?: boolean;
}

function ServiceCard({ service, businessId, isEditing }: ServiceCardProps) {
  const [isBooking, setBooking] = useState(false);

  return (
    <div className={cn(primitives['simple-card'], styles.card)}>
      <FavoriteButton
        className={styles['card__favorite']}
        isEditing={isEditing}
        item={{
          id: service.id,
          kind: 'service',
          name: service.name,
          image: service.images[0] ?? null,
          priceCents: service.priceCents,
          currency: service.currency,
        }}
      />
      {service.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото услуги
        <img src={service.images[0]} alt="" className={primitives['simple-card__image']} />
      ) : (
        <div className={styles['card__no-image']}>
          <CalendarIcon />
        </div>
      )}
      <div className={primitives['simple-card__body']}>
        <h3 className={primitives['simple-card__title']}>{service.name}</h3>
        {service.description && (
          <p className={primitives['simple-card__description']}>{service.description}</p>
        )}
        <div className={styles['card__footer']}>
          <span className={styles['card__meta']}>
            {formatMoney(service.priceCents, service.currency)} ·{' '}
            {formatDuration(service.durationMinutes)}
          </span>
          <button
            type="button"
            className={styles['card__button']}
            onClick={() => {
              if (!isEditing) setBooking(true);
            }}
          >
            <CalendarIcon />
            Записаться
          </button>
        </div>
      </div>

      {isBooking && (
        <BookingModal businessId={businessId} service={service} onClose={() => setBooking(false)} />
      )}
    </div>
  );
}

function ServiceGridRenderer({
  props,
  business,
  isEditing,
  onEditProp,
}: BlockRendererProps<ServiceGridProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const fetcher = useCallback(() => getPublicServices(business.businessId), [business.businessId]);
  const { status, data, error } = useAsyncData(fetcher);

  // См. тот же вызов и его комментарий в `ProductGridRenderer`
  // (`blocks/commerce/index.tsx`) — здесь нужен по той же причине,
  // `ServiceCard` тоже рендерит `FavoriteButton`.
  const ensureFavoritesBusiness = useFavoriteStore((state) => state.ensureBusiness);
  useEffect(() => {
    ensureFavoritesBusiness(business.businessId);
  }, [business.businessId, ensureFavoritesBusiness]);

  if (status === 'loading') {
    return (
      <div className={styles.placeholder}>
        <CalendarIcon />
        <span>Загружаем услуги…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.placeholder}>
        <CalendarIcon />
        <span>{error ?? 'Не удалось загрузить услуги'}</span>
      </div>
    );
  }

  const sorted = sortServices(data ?? [], props.dataSource.sort);
  const limited = sorted.slice(0, props.dataSource.limit);

  if (limited.length === 0) {
    return (
      <div className={styles.placeholder}>
        <CalendarIcon />
        <span>Здесь пока нет услуг — добавьте их в разделе «Услуги» дашборда бизнеса.</span>
      </div>
    );
  }

  return (
    <div className={primitives.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div
        className={primitives['simple-grid']}
        style={{ '--grid-columns': props.columns } as CSSProperties}
      >
        {limited.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            businessId={business.businessId}
            isEditing={isEditing}
          />
        ))}
      </div>
    </div>
  );
}

const serviceGridFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  { key: 'dataSource', label: 'Услуги', control: 'dataSource', entity: 'service' },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

registerBlock<ServiceGridProps>({
  type: 'servicegrid',
  label: 'Услуги',
  category: 'booking',
  icon: CalendarIcon,
  description:
    'Услуги из раздела «Услуги» дашборда — с ценами, длительностью и кнопкой «Записаться»',
  capability: 'booking',
  defaultProps: {
    eyebrow: '',
    heading: 'Наши услуги',
    description: '',
    dataSource: { limit: 6, sort: 'newest' },
    columns: 3,
  },
  fields: serviceGridFields,
  Renderer: ServiceGridRenderer,
});
