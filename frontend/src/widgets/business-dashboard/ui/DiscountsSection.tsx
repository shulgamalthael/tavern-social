'use client';

import { useCallback, useState } from 'react';
import { updateBusiness, type Business } from '@/entities/business';
import { deleteDiscount, getDiscounts, type Discount } from '@/entities/discount';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { EditIcon, PlusIcon, TagIcon, TrashIcon } from '@/shared/ui/icons';
import { DiscountFormModal } from './DiscountFormModal';
// Разметка списка идентична `ProductsSection`/`ServicesSection` (иконка/
// название/мета/действия в ряд) — переиспользуем тот же модуль стилей, тот
// же приём, что уже применён у `ServicesSection` (см. её комментарий).
import styles from './ProductsSection.module.scss';

export interface DiscountsSectionProps {
  business: Business;
  onCapabilityEnabled: () => void;
}

/** Скидки/промокоды (Pricing Engine, Phase 17 — см. `PRICING_ARCHITECTURE.md`)
 * — гейтится капабилити `commerce`, тот же принцип, что `ProductsSection`:
 * скидка применяется к `Order` из корзины (Commerce), у Booking своего
 * ценового движка в этой фазе нет (см. §8 документа архитектуры,
 * "Explicitly deferred"). */
export function DiscountsSection({ business, onCapabilityEnabled }: DiscountsSectionProps) {
  const fetcher = useCallback(() => getDiscounts(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isEnabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null | 'new'>(null);
  const [confirmTarget, setConfirmTarget] = useState<Discount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasCommerce = business.capabilities.includes('commerce');

  async function handleEnable() {
    setEnabling(true);
    setEnableError(null);
    try {
      await updateBusiness(business.id, { capabilities: [...business.capabilities, 'commerce'] });
      onCapabilityEnabled();
    } catch {
      setEnableError('Не удалось включить онлайн-магазин — попробуйте ещё раз');
    } finally {
      setEnabling(false);
    }
  }

  async function handleDelete(discount: Discount) {
    setDeletingId(discount.id);
    setDeleteError(null);
    try {
      await deleteDiscount(business.id, discount.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить скидку — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (!hasCommerce) {
    return (
      <EmptyState
        title="Онлайн-магазин выключен"
        description="Скидки применяются к заказам из корзины — включите онлайн-магазин, чтобы начать."
        action={
          <>
            <Button onClick={() => void handleEnable()} disabled={isEnabling}>
              <TagIcon />
              {isEnabling ? 'Включаем…' : 'Включить онлайн-магазин'}
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
        <Loader label="Загружаем скидки…" />
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
          Скидка без промокода применяется автоматически ко всем подходящим заказам.
        </p>
        <Button onClick={() => setEditingDiscount('new')}>
          <PlusIcon />
          Добавить скидку
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одной скидки"
          description="Добавьте первую — процент или фиксированную сумму, с промокодом или без."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((discount) => (
            <li key={discount.id} className={styles.row}>
              <div className={styles['row__image']}>
                <TagIcon />
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>
                  {discount.name}
                  {!discount.isActive && <span className={styles.row__hidden}>выключена</span>}
                </span>
                <span className={styles.row__meta}>
                  {discount.type === 'percentage'
                    ? `${discount.value}%`
                    : formatMoney(discount.value, business.currency)}
                  {discount.code ? ` · код ${discount.code}` : ' · автоматическая'}
                  {discount.usageLimit != null &&
                    ` · использовано ${discount.usageCount}/${discount.usageLimit}`}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Редактировать «${discount.name}»`}
                onClick={() => setEditingDiscount(discount)}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${discount.name}»`}
                disabled={deletingId === discount.id}
                onClick={() => setConfirmTarget(discount)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingDiscount && (
        <DiscountFormModal
          businessId={business.id}
          currency={business.currency}
          discount={editingDiscount === 'new' ? null : editingDiscount}
          onSaved={() => {
            setEditingDiscount(null);
            void refetch();
          }}
          onClose={() => setEditingDiscount(null)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить скидку «{confirmTarget.name}»? Это необратимо.
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
