'use client';

import { useState } from 'react';
import { useGlobalSearch } from '@/features/global-search';
import { Avatar } from '@/shared/ui/Avatar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './AddParticipantDropdown.module.scss';

export interface AddParticipantDropdownProps {
  /** Кого не показывать в результатах — себя и уже добавленных собеседников. */
  excludeUserIds: string[];
  /** Личная переписка (1:1) — добавление создаст новый групповой чат, а не
   * превратит эту личку в групповую (см. `ThreadsService.addParticipant` на
   * backend); показываем предупреждение, чтобы это не было сюрпризом. */
  isDirectThread: boolean;
  onAdd: (userId: string) => Promise<void>;
  onClose: () => void;
}

/** Поиск + добавление собеседника в открытый диалог — компактный дропдаун
 * под кнопкой в хедере мессенджера, тот же паттерн позиционирования, что и
 * у `NotificationsDropdown`/`SearchDropdown`. */
export function AddParticipantDropdown({
  excludeUserIds,
  isDirectThread,
  onAdd,
  onClose,
}: AddParticipantDropdownProps) {
  const [query, setQuery] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const { status, data, error } = useGlobalSearch(query);

  const results = (data?.users ?? []).filter((user) => !excludeUserIds.includes(user.id));

  const handleAdd = async (userId: string) => {
    setPendingUserId(userId);
    setAddError(null);
    try {
      await onAdd(userId);
      onClose();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Не удалось добавить собеседника');
      setPendingUserId(null);
    }
  };

  return (
    <div className={styles.dropdown}>
      {isDirectThread && (
        <p className={styles['dropdown__hint']}>
          Это личный диалог — добавление создаст новый групповой чат с текущим собеседником, а
          личная переписка останется как есть.
        </p>
      )}

      <input
        autoFocus
        type="search"
        className={styles['dropdown__input']}
        placeholder="Найти человека…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {addError && <p className={styles['dropdown__error']}>{addError}</p>}

      <ScrollArea
        className={styles['dropdown__results']}
        viewportClassName={styles['dropdown__viewport']}
        role="listbox"
      >
        {status === 'idle' && (
          <EmptyState
            className={styles['dropdown__state']}
            title="Введите имя"
            description="Начните вводить, чтобы найти человека."
          />
        )}

        {status === 'loading' && <Loader label="Ищем…" className={styles['dropdown__state']} />}

        {status === 'error' && <ErrorState message={error} className={styles['dropdown__state']} />}

        {status === 'success' && results.length === 0 && (
          <EmptyState
            className={styles['dropdown__state']}
            title="Никого не нашли"
            description="Попробуйте другое имя."
          />
        )}

        {status === 'success' && results.length > 0 && (
          <div className={styles['dropdown__list']}>
            {results.map((user) => (
              <button
                key={user.id}
                type="button"
                className={styles['dropdown__row']}
                disabled={pendingUserId === user.id}
                onClick={() => void handleAdd(user.id)}
              >
                <Avatar initials={user.initials} src={user.avatarUrl} size="sm" />
                <span className={styles['dropdown__row-body']}>
                  <span className={styles['dropdown__row-title']}>{user.name}</span>
                  <span className={styles['dropdown__row-subtitle']}>
                    {user.tagline || 'пока без подписи'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
