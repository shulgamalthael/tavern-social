'use client';

import { useCallback, useState } from 'react';
import {
  getBusinessNotifications,
  markNotificationRead,
  type BusinessNotification,
} from '@/entities/notification';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './RuleNotificationsFeed.module.scss';

export interface RuleNotificationsFeedProps {
  businessId: string;
}

/**
 * Business Logic Engine's notifications-экран (AI_PLATFORM_ROADMAP.md §15.4)
 * — читает `Notification` строки типа `rule_triggered`, которые правило
 * записало через `send_notification`-действие (см. `RulesService.
 * runActions`), но которые НЕ показываются в общей социальной ленте (см.
 * backend's `FEED_EXCLUDED_TYPES` — у события нет человека-"актёра", общий
 * рендер `NotificationItem` на это не рассчитан). Переиспользует
 * существующий `markNotificationRead` (`entities/notification`) — он уже
 * фильтрует только по `recipientId`, не по типу, значит работает для этих
 * строк без изменений на backend.
 *
 * Перечитывает список при каждом монтировании (не хранит состояние между
 * переключениями вкладок) — та же простая логика, что у `AiActivityFeed`
 * (AI-3, §10.7): у этого фида нет клиентского состояния, которое стоило бы
 * сохранять.
 */
export function RuleNotificationsFeed({ businessId }: RuleNotificationsFeedProps) {
  const fetcher = useCallback(() => getBusinessNotifications(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function handleMarkRead(notification: BusinessNotification) {
    setMarkingId(notification.id);
    try {
      await markNotificationRead(notification.id);
      await refetch();
    } finally {
      setMarkingId(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем уведомления…" />
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
        title="Пока нет уведомлений"
        description="Здесь появится история срабатываний правил — например, «Новый заказ на 500 ₴»."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {data.map((notification) => (
        <li
          key={notification.id}
          className={cn(styles.item, !notification.isRead && styles['item--unread'])}
        >
          <div className={styles.item__body}>
            <span className={styles.item__summary}>{notification.summary}</span>
            <span className={styles.item__date}>
              {new Date(notification.createdAt).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {!notification.isRead && (
            <button
              type="button"
              className={styles.item__markRead}
              disabled={markingId === notification.id}
              onClick={() => void handleMarkRead(notification)}
            >
              {markingId === notification.id ? 'Отмечаем…' : 'Прочитано'}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
