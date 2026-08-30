'use client';

import { useCallback, useState } from 'react';
import {
  getAppointments,
  refundAppointment,
  updateAppointmentStatus,
  APPOINTMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type AppointmentStatus,
} from '@/entities/appointment';
import { formatDuration } from '@/entities/service';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './OrdersSection.module.scss';

export interface AppointmentsSectionProps {
  businessId: string;
}

const STATUS_OPTIONS: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

/**
 * Зеркало `OrdersSection.tsx` (Booking вместо Commerce) — заявки на запись
 * с витрины (см. `entities/appointment`), без движка доступности: владелец
 * видит желаемое время и контакты клиента и подтверждает/переносит сам.
 * Тоже не гейтится капабилити — история записей должна остаться видимой,
 * даже если запись на услуги потом выключили (тот же принцип, что и у
 * `OrdersSection`).
 */
export function AppointmentsSection({ businessId }: AppointmentsSectionProps) {
  const fetcher = useCallback(() => getAppointments(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);
  // См. `OrdersSection` — реальное движение денег получает свою явную
  // ошибку, а не молчаливый откат к перечитанному состоянию.
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<{ appointmentId: string; message: string } | null>(
    null,
  );

  async function handleStatusChange(appointmentId: string, nextStatus: AppointmentStatus) {
    try {
      await updateAppointmentStatus(businessId, appointmentId, nextStatus);
      await refetch();
    } catch {
      // См. `OrdersSection` — перечитываем правду с сервера, а не держим
      // оптимистичное предположение молча провалившимся.
    }
  }

  async function handleRefund(appointmentId: string) {
    setRefundError(null);
    setRefundingId(appointmentId);
    try {
      await refundAppointment(businessId, appointmentId);
      await refetch();
    } catch (error) {
      setRefundError({
        appointmentId,
        message: error instanceof Error ? error.message : 'Не удалось выполнить возврат',
      });
    } finally {
      setRefundingId(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем записи…" />
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
        title="Пока нет записей"
        description="Записи появятся здесь, как только клиент оформит их через блок «Услуги» на сайте."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {data.map((appointment) => (
        <li key={appointment.id} className={styles.card}>
          <div className={styles.card__header}>
            <div>
              <span className={styles.customerName}>{appointment.customerName}</span>
              <span className={styles.date}>
                {new Date(appointment.startsAt).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <select
              className={styles.statusSelect}
              data-status={appointment.status}
              value={appointment.status}
              onChange={(event) =>
                void handleStatusChange(appointment.id, event.target.value as AppointmentStatus)
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {APPOINTMENT_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          {(appointment.customerPhone || appointment.customerEmail) && (
            <div className={styles.contacts}>
              {appointment.customerPhone && <span>{appointment.customerPhone}</span>}
              {appointment.customerEmail && <span>{appointment.customerEmail}</span>}
            </div>
          )}

          <div className={styles.items}>
            <span className={styles.item}>
              <span>
                {appointment.serviceName} · {formatDuration(appointment.durationMinutes)}
              </span>
              <span>{formatMoney(appointment.priceCents, appointment.currency)}</span>
            </span>
          </div>

          {appointment.customerNote && <p className={styles.note}>«{appointment.customerNote}»</p>}

          <div className={styles.total}>
            <div className={styles.paymentGroup}>
              <span className={styles.paymentBadge} data-payment-status={appointment.paymentStatus}>
                {PAYMENT_STATUS_LABELS[appointment.paymentStatus]}
              </span>
              {appointment.paymentStatus === 'paid' && (
                <button
                  type="button"
                  className={styles.refundButton}
                  disabled={refundingId === appointment.id}
                  onClick={() => void handleRefund(appointment.id)}
                >
                  {refundingId === appointment.id ? 'Возврат…' : 'Вернуть деньги'}
                </button>
              )}
            </div>
          </div>

          {refundError?.appointmentId === appointment.id && (
            <p className={styles.refundError}>{refundError.message}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
