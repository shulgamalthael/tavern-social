'use client';

import { useCallback } from 'react';
import {
  getOrders,
  updateOrderStatus,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderStatus,
} from '@/entities/order';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './OrdersSection.module.scss';

export interface OrdersSectionProps {
  businessId: string;
}

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

/**
 * Заявки, оформленные с витрины (см. `entities/cart/ui/CartWidget.tsx`).
 * `status` (шапка) — выполнение заказа продавцом, переводится вручную
 * (подтвердил/выполнил/отменил) по мере того как обрабатывает заказ сам
 * (звонок/мессенджер). `paymentStatus` (бейдж у итога) — отдельная ось про
 * деньги: если у бизнеса настроен Stripe, заказ мог быть уже оплачен
 * покупателем через Payment Element ещё до того, как продавец его увидел;
 * если Stripe не настроен, `paymentStatus` всегда `unpaid` — заказ остаётся
 * честной заявкой (см. ROADMAP.md §8 Phase 5). Не гейтится капабилити
 * `commerce` так же строго, как «Товары»: если капабилити когда-то
 * выключили, уже оформленные заказы не должны стать недоступны для
 * просмотра — история заказов переживает выключение витрины.
 */
export function OrdersSection({ businessId }: OrdersSectionProps) {
  const fetcher = useCallback(() => getOrders(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    try {
      await updateOrderStatus(businessId, orderId, nextStatus);
      await refetch();
    } catch {
      // `refetch` без изменений покажет актуальное (старое) состояние — тот
      // же принцип, что и у `PagesSection`: перечитываем правду с сервера,
      // а не держим оптимистичное предположение молча провалившимся.
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем заказы…" />
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

  if (data.length === 0) {
    return (
      <EmptyState
        title="Пока нет заказов"
        description="Заказы появятся здесь, как только покупатель оформит их через корзину на сайте."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {data.map((order) => (
        <li key={order.id} className={styles.card}>
          <div className={styles.card__header}>
            <div>
              <span className={styles.customerName}>{order.customerName}</span>
              <span className={styles.date}>
                {new Date(order.createdAt).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <select
              className={styles.statusSelect}
              data-status={order.status}
              value={order.status}
              onChange={(event) =>
                void handleStatusChange(order.id, event.target.value as OrderStatus)
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ORDER_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          {(order.customerPhone || order.customerEmail) && (
            <div className={styles.contacts}>
              {order.customerPhone && <span>{order.customerPhone}</span>}
              {order.customerEmail && <span>{order.customerEmail}</span>}
            </div>
          )}

          <ul className={styles.items}>
            {order.items.map((item) => (
              <li key={item.id} className={styles.item}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatMoney(item.priceCents * item.quantity, order.currency)}</span>
              </li>
            ))}
          </ul>

          {order.customerNote && <p className={styles.note}>«{order.customerNote}»</p>}

          {(order.discountCents > 0 || order.taxCents > 0) && (
            <div className={styles.breakdown}>
              <div className={styles.breakdownRow}>
                <span>Подытог</span>
                <span>{formatMoney(order.subtotalCents, order.currency)}</span>
              </div>
              {order.discountCents > 0 && (
                <div className={styles.breakdownRow}>
                  <span>Скидка{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                  <span>−{formatMoney(order.discountCents, order.currency)}</span>
                </div>
              )}
              {order.taxCents > 0 && (
                <div className={styles.breakdownRow}>
                  <span>Налог</span>
                  <span>{formatMoney(order.taxCents, order.currency)}</span>
                </div>
              )}
            </div>
          )}

          <div className={styles.total}>
            <span className={styles.paymentBadge} data-payment-status={order.paymentStatus}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </span>
            <span>Итого: {formatMoney(order.totalCents, order.currency)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
