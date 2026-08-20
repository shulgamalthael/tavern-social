'use client';

import { NotificationItem, useNotificationStore } from '@/entities/notification';
import { useNavigationStore } from '@/features/section-navigation';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './NotificationsDropdown.module.scss';

const PREVIEW_COUNT = 5;

export interface NotificationsDropdownProps {
  /** Закрыть дропдаун без перехода на страницу уведомлений (клик по строке —
   * там переход сразу на свой профиль, как в toast'ах). */
  onClose: () => void;
  /** «Посмотреть все» — переход на полную страницу уведомлений. */
  onViewAll: () => void;
}

/** Компактный превью последних уведомлений — не заменяет полноценную страницу
 * `widgets/notifications`, только короткий срез + переход туда. */
export function NotificationsDropdown({ onClose, onViewAll }: NotificationsDropdownProps) {
  const items = useNotificationStore((state) => state.items);
  const status = useNotificationStore((state) => state.status);
  const error = useNotificationStore((state) => state.error);
  const markRead = useNotificationStore((state) => state.markRead);
  const goToSection = useNavigationStore((state) => state.goToSection);

  const preview = items.slice(0, PREVIEW_COUNT);

  return (
    <ScrollArea
      className={styles.dropdown}
      viewportClassName={styles['dropdown__viewport']}
      role="listbox"
    >
      {status === 'loading' && <Loader label="Загружаем…" className={styles['dropdown__state']} />}

      {status === 'error' && <ErrorState message={error} className={styles['dropdown__state']} />}

      {status === 'success' && preview.length === 0 && (
        <EmptyState className={styles['dropdown__state']} title="Пока нет уведомлений" />
      )}

      {status === 'success' && preview.length > 0 && (
        <div className={styles['dropdown__list']}>
          {preview.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => {
                if (!notification.isRead) void markRead(notification.id);
                onClose();
                goToSection('profile');
              }}
            />
          ))}
        </div>
      )}

      <Button variant="ghost" fullWidth className={styles['dropdown__all']} onClick={onViewAll}>
        Посмотреть все
      </Button>
    </ScrollArea>
  );
}
