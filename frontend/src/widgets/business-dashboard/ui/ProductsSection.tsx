'use client';

import { useCallback, useState } from 'react';
import { updateBusiness, type Business } from '@/entities/business';
import { deleteProduct, getProducts, type Product } from '@/entities/product';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { EditIcon, PlusIcon, ShoppingBagIcon, TrashIcon } from '@/shared/ui/icons';
import { ProductFormModal } from './ProductFormModal';
import styles from './ProductsSection.module.scss';

export interface ProductsSectionProps {
  business: Business;
  onCapabilityEnabled: () => void;
}

/**
 * Первая capability-специфичная секция Dashboard (Commerce, см. ROADMAP.md
 * §8 Phase 5) — раньше здесь не было ни одной, ровно по причине, объяснённой
 * в комментарии `BusinessDashboardWidget.tsx` («показывать пункты меню для
 * функциональности, которой физически не существует, было бы фальшивым
 * UI»): теперь Commerce реален (`Product`/`ProductsModule` на backend), но
 * ВКЛЮЧЕНА не для каждого бизнеса — вкладка видна всегда (см. родителя), а
 * сама секция сначала предлагает включить капабилити, если она ещё не
 * включена, вместо того чтобы прятать раздел целиком (тот же принцип
 * прогрессивной сложности, что и у остального Dashboard: фича обнаружима,
 * но не навязана).
 *
 * Собственный `useAsyncData`, не через родителя — список товаров не нужен
 * ни одной другой секции Dashboard (в отличие от `draft`, который делят
 * «Обзор» и «Страницы»).
 */
export function ProductsSection({ business, onCapabilityEnabled }: ProductsSectionProps) {
  const fetcher = useCallback(() => getProducts(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isEnabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null | 'new'>(null);
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null);
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

  async function handleDelete(product: Product) {
    setDeletingId(product.id);
    setDeleteError(null);
    try {
      await deleteProduct(business.id, product.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить товар — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (!hasCommerce) {
    return (
      <EmptyState
        title="Онлайн-магазин выключен"
        description="Включите его, чтобы добавлять товары с ценами и фото — они появятся на сайте в блоке «Каталог товаров»."
        action={
          <>
            <Button onClick={() => void handleEnable()} disabled={isEnabling}>
              <ShoppingBagIcon />
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
        <Loader label="Загружаем товары…" />
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
          Добавьте блок «Каталог товаров» в конструкторе, чтобы показать их на сайте.
        </p>
        <Button onClick={() => setEditingProduct('new')}>
          <PlusIcon />
          Добавить товар
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одного товара"
          description="Добавьте первый товар — название, цена и фото достаточно, чтобы начать."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((product) => (
            <li key={product.id} className={styles.row}>
              <div className={styles['row__image']}>
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- превью загруженного фото товара
                  <img src={product.images[0]} alt="" />
                ) : (
                  <ShoppingBagIcon />
                )}
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>
                  {product.name}
                  {!product.isActive && <span className={styles.row__hidden}>скрыт</span>}
                </span>
                <span className={styles.row__meta}>
                  {formatMoney(product.priceCents, product.currency)}
                  {product.stock != null && ` · остаток: ${product.stock}`}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Редактировать «${product.name}»`}
                onClick={() => setEditingProduct(product)}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${product.name}»`}
                disabled={deletingId === product.id}
                onClick={() => setConfirmTarget(product)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingProduct && (
        <ProductFormModal
          businessId={business.id}
          currency={business.currency}
          product={editingProduct === 'new' ? null : editingProduct}
          onSaved={() => {
            setEditingProduct(null);
            void refetch();
          }}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить товар «{confirmTarget.name}»? Это необратимо.
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
