'use client';

import { useEffect, useRef } from 'react';
import { NotificationItem, type Notification, useNotificationStore } from '@/entities/notification';
import { useNavigationStore } from '@/features/section-navigation';
import { formatDayLabel } from '@/shared/lib/format-day-label';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './NotificationsWidget.module.scss';

interface NotificationGroup {
  label: string;
  items: Notification[];
}

/** Клиентская группировка по дню — только для заголовков-разделителей в
 * списке, backend отдаёт плоский массив, отсортированный по `createdAt`. */
function groupByDay(items: Notification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const label = formatDayLabel(item.createdAt);
    const lastGroup = groups.at(-1);
    if (lastGroup?.label === label) {
      lastGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

export function NotificationsWidget() {
  const items = useNotificationStore((state) => state.items);
  const status = useNotificationStore((state) => state.status);
  const error = useNotificationStore((state) => state.error);
  const loadMoreStatus = useNotificationStore((state) => state.loadMoreStatus);
  const nextCursor = useNotificationStore((state) => state.nextCursor);
  const loadFirstPage = useNotificationStore((state) => state.loadFirstPage);
  const loadMore = useNotificationStore((state) => state.loadMore);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const goToSection = useNavigationStore((state) => state.goToSection);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadFirstPage();
    // Один раз при заходе в раздел — счётчик в шапке живёт отдельно
    // (см. `entities/notification/model/notification-store.ts`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  const hasUnread = items.some((item) => !item.isRead);
  const groups = groupByDay(items);

  const openNotification = (notification: Notification) => {
    if (!notification.isRead) void markRead(notification.id);
    goToSection('profile');
  };

  return (
    <SectionContainer>
      <div className={styles.header}>
        <PageHead title="Уведомления" />
        {hasUnread && (
          <Button variant="outline" onClick={() => void markAllRead()}>
            Прочитать всё
          </Button>
        )}
      </div>

      {status === 'loading' && <Loader label="Загружаем уведомления…" />}
      {status === 'error' && <ErrorState message={error} onRetry={loadFirstPage} />}

      {status === 'success' && items.length === 0 && (
        <EmptyState
          title="Пока нет уведомлений"
          description="Здесь появятся лайки, комментарии и репосты ваших записей."
        />
      )}

      {status === 'success' && items.length > 0 && (
        <div className={styles.list}>
          {groups.map((group) => (
            <div key={group.label} className={styles['list__group']}>
              <h2 className={styles['list__group-title']}>{group.label}</h2>
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => openNotification(notification)}
                />
              ))}
            </div>
          ))}
          <div ref={sentinelRef} aria-hidden="true" />
          {loadMoreStatus === 'loading' && <Loader label="Загружаем ещё…" />}
        </div>
      )}
    </SectionContainer>
  );
}
