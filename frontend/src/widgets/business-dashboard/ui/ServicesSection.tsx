'use client';

import { useCallback, useState } from 'react';
import { updateBusiness, type Business } from '@/entities/business';
import { deleteService, formatDuration, getServices, type Service } from '@/entities/service';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ClockIcon, EditIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { ServiceFormModal } from './ServiceFormModal';
import styles from './ProductsSection.module.scss';

export interface ServicesSectionProps {
  business: Business;
  onCapabilityEnabled: () => void;
}

/**
 * Зеркало `ProductsSection.tsx` (Booking вместо Commerce, см. ROADMAP.md §8
 * Phase 6) — та же логика «вкладка видна всегда, секция сама предлагает
 * включить капабилити», переиспользует те же стили (`ProductsSection.
 * module.scss`), потому что разметка списка идентична (иконка/название/
 * мета-строка/действия).
 */
export function ServicesSection({ business, onCapabilityEnabled }: ServicesSectionProps) {
  const fetcher = useCallback(() => getServices(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isEnabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null | 'new'>(null);
  const [confirmTarget, setConfirmTarget] = useState<Service | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasBooking = business.capabilities.includes('booking');

  async function handleEnable() {
    setEnabling(true);
    setEnableError(null);
    try {
      await updateBusiness(business.id, { capabilities: [...business.capabilities, 'booking'] });
      onCapabilityEnabled();
    } catch {
      setEnableError('Не удалось включить запись на услуги — попробуйте ещё раз');
    } finally {
      setEnabling(false);
    }
  }

  async function handleDelete(service: Service) {
    setDeletingId(service.id);
    setDeleteError(null);
    try {
      await deleteService(business.id, service.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить услугу — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (!hasBooking) {
    return (
      <EmptyState
        title="Запись на услуги выключена"
        description="Включите её, чтобы добавлять услуги с ценами и длительностью — они появятся на сайте в блоке «Услуги», с кнопкой «Записаться»."
        action={
          <>
            <Button onClick={() => void handleEnable()} disabled={isEnabling}>
              <ClockIcon />
              {isEnabling ? 'Включаем…' : 'Включить запись на услуги'}
            </Button>
            {enableError && (
              <p className={styles.error} role="alert">
                {enableError}
              </p>
            )}
          </>
        }
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем услуги…" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <p className={styles.hint}>
          Добавьте блок «Услуги» в конструкторе, чтобы показать их на сайте.
        </p>
        <Button onClick={() => setEditingService('new')}>
          <PlusIcon />
          Добавить услугу
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одной услуги"
          description="Добавьте первую услугу — название, цена и длительность достаточно, чтобы начать."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((service) => (
            <li key={service.id} className={styles.row}>
              <div className={styles['row__image']}>
                {service.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- превью загруженного фото услуги
                  <img src={service.images[0]} alt="" />
                ) : (
                  <ClockIcon />
                )}
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>
                  {service.name}
                  {!service.isActive && <span className={styles.row__hidden}>скрыт</span>}
                </span>
                <span className={styles.row__meta}>
                  {formatMoney(service.priceCents, service.currency)} ·{' '}
                  {formatDuration(service.durationMinutes)}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Редактировать «${service.name}»`}
                onClick={() => setEditingService(service)}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${service.name}»`}
                disabled={deletingId === service.id}
                onClick={() => setConfirmTarget(service)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingService && (
        <ServiceFormModal
          businessId={business.id}
          currency={business.currency}
          service={editingService === 'new' ? null : editingService}
          onSaved={() => {
            setEditingService(null);
            void refetch();
          }}
          onClose={() => setEditingService(null)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить услугу «{confirmTarget.name}»? Это необратимо.
            </p>
            <div className={styles.confirmCard__actions}>
              <button
                type="button"
                className={styles.confirmCard__cancel}
                onClick={() => setConfirmTarget(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmCard__delete}
                disabled={deletingId === confirmTarget.id}
                onClick={() => void handleDelete(confirmTarget)}
              >
                {deletingId === confirmTarget.id ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
