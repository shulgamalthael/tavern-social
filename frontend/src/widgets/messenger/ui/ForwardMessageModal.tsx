'use client';

import { useState } from 'react';
import type { Thread } from '@/entities/thread';
import { Avatar } from '@/shared/ui/Avatar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Modal } from '@/shared/ui/Modal';
import styles from './ForwardMessageModal.module.scss';

export interface ForwardMessageModalProps {
  threads: Thread[];
  onForward: (targetThreadId: string) => Promise<void>;
  onClose: () => void;
}

/** Пикер диалога для пересылки — список УЖЕ загруженных диалогов
 * (`useThreadStore.threads`) с локальным фильтром по имени, тот же паттерн
 * оверлея, что у `Modal` (карточка редактирования поста). */
export function ForwardMessageModal({ threads, onForward, onClose }: ForwardMessageModalProps) {
  const [query, setQuery] = useState('');
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);

  const results = threads.filter((thread) =>
    thread.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleForward = async (targetThreadId: string) => {
    setPendingThreadId(targetThreadId);
    setForwardError(null);
    try {
      await onForward(targetThreadId);
      onClose();
    } catch (err) {
      setForwardError(err instanceof Error ? err.message : 'Не удалось переслать сообщение');
      setPendingThreadId(null);
    }
  };

  return (
    <Modal onClose={onClose} label="Переслать сообщение" className={styles.forward}>
      <h2 className={styles['forward__title']}>Переслать сообщение</h2>

      <input
        autoFocus
        type="search"
        className={styles['forward__input']}
        placeholder="Найти диалог…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {forwardError && <p className={styles['forward__error']}>{forwardError}</p>}

      {results.length === 0 ? (
        <EmptyState
          className={styles['forward__state']}
          title="Ничего не нашли"
          description="Попробуйте другое имя диалога."
        />
      ) : (
        <div className={styles['forward__list']}>
          {results.map((thread) => (
            <button
              key={thread.id}
              type="button"
              className={styles['forward__row']}
              disabled={pendingThreadId === thread.id}
              onClick={() => void handleForward(thread.id)}
            >
              <Avatar initials={thread.initials} src={thread.avatarUrl} size="sm" />
              <span className={styles['forward__row-name']}>{thread.name}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
