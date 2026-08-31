import type { PlanEvent, PlanEventType } from '@/entities/subscription';
import type { AsyncDataState } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './PlanHistoryList.module.scss';

const EVENT_LABELS: Record<PlanEventType, string> = {
  free_selected: 'Выбран бесплатный тариф',
  checkout_started: 'Начата оплата подписки',
  checkout_completed: 'Подписка оплачена',
  checkout_canceled: 'Оплата отменена',
  subscription_updated: 'Подписка обновлена',
  subscription_canceled: 'Подписка отменена',
  enterprise_inquiry: 'Отправлена заявка на Enterprise',
};

export interface PlanHistoryListProps {
  history: AsyncDataState<PlanEvent[]>;
}

/** История выбора/оплаты тарифа — audit trail должен быть виден владельцу,
 * не только храниться в БД (см. `PlanSelectionEvent`, implementation plan
 * "Audit trail visibility"). Чисто презентационный компонент — данные и
 * `refetch` после успешных действий владеет `PlanSelectorWidget` (тот же
 * приём "родитель зовёт refetch колбэком", что `BusinessDashboardWidget`'s
 * `onCapabilityEnabled={() => void business.refetch()}"), не отдельный
 * `useAsyncData` внутри самого списка. */
export function PlanHistoryList({ history }: PlanHistoryListProps) {
  const { status, data, error, refetch } = history;

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем историю…" />
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
        title="История пока пуста"
        description="Здесь появится каждое действие с тарифом — выбор, оплата, отмена."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {data.map((event) => (
        <li key={event.id} className={styles.item}>
          <span className={styles.item__label}>{EVENT_LABELS[event.type]}</span>
          <span className={styles.item__date}>
            {new Date(event.createdAt).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
