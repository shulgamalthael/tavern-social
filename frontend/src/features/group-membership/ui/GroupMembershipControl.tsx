'use client';

import { useState } from 'react';
import { useGroupStore, type Group } from '@/entities/group';
import { Button } from '@/shared/ui/Button';
import styles from './GroupMembershipControl.module.scss';

export interface GroupMembershipControlProps {
  group: Group;
}

/**
 * Кнопка(и) статуса членства — переиспользуется и в карточке каталога
 * (`GroupRow.actions`), и на странице группы (`GroupPageView`), источник —
 * `useGroupStore` (см. AGENTS.md §4). Владелец здесь ничего не видит — его
 * управление группой отдельная фича (`features/manage-group`).
 */
export function GroupMembershipControl({ group }: GroupMembershipControlProps) {
  const joinGroup = useGroupStore((state) => state.joinGroup);
  const leaveGroup = useGroupStore((state) => state.leaveGroup);
  const requestGroupJoin = useGroupStore((state) => state.requestGroupJoin);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (isPending) return;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось выполнить действие',
      );
    } finally {
      setPending(false);
    }
  };

  if (group.currentUserRole === 'owner') {
    return (
      <Button variant="soft" disabled>
        Вы владелец
      </Button>
    );
  }

  if (group.currentUserRole === 'member') {
    return (
      <div className={styles.control}>
        <Button variant="soft" disabled>
          Вы участник
        </Button>
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => void run(() => leaveGroup(group.id))}
        >
          {isPending ? 'Уходим…' : 'Покинуть группу'}
        </Button>
        {error && <p className={styles['control__error']}>{error}</p>}
      </div>
    );
  }

  if (group.hasPendingJoinRequest) {
    return (
      <Button variant="outline" disabled>
        Запрос отправлен
      </Button>
    );
  }

  return (
    <div className={styles.control}>
      <Button
        variant="primary"
        disabled={isPending}
        onClick={() =>
          void run(() => (group.type === 'open' ? joinGroup(group.id) : requestGroupJoin(group.id)))
        }
      >
        {isPending ? 'Секунду…' : group.type === 'open' ? 'Вступить' : 'Отправить запрос'}
      </Button>
      {error && <p className={styles['control__error']}>{error}</p>}
    </div>
  );
}
