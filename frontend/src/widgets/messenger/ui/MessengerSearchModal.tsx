'use client';

import { useMemo, useState } from 'react';
import { type ChatMessage, type Thread, type ThreadParticipant } from '@/entities/thread';
import { useGlobalSearch } from '@/features/global-search';
import { useAllThreadsSearch } from '@/features/search-messages';
import { formatMessageTime } from '@/shared/lib/format-message-time';
import { Avatar } from '@/shared/ui/Avatar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './MessengerSearchModal.module.scss';

export interface MessengerSearchModalProps {
  /** Уже загруженные диалоги (`useThreadStore.threads`) — подписать
   * результаты поиска по сообщениям именем/аватаром собеседника и найти чат
   * по имени участника (см. `chatMatches` ниже); сам полнотекстовый поиск
   * идёт по backend. */
  threads: Thread[];
  onSelectMessage: (threadId: string, messageId: string) => void;
  onSelectThread: (threadId: string) => void;
  onSelectPerson: (person: ThreadParticipant) => void;
  onClose: () => void;
}

interface ChatMatch {
  thread: Thread;
  messages: ChatMessage[];
}

/**
 * Единый поиск на странице «Диалоги» — раньше отдельная модалка
 * (`AllThreadsSearchModal`, теперь эта) искала только текст сообщений в уже
 * открытых чатах: не найти ни собеседника без переписки, ни групповой чат по
 * имени участника, если ни один текст сообщения с этим именем не совпал.
 * Здесь этот виджет, а не `features/search-messages` — потому что сводит
 * вместе два разных `features` (поиск по сообщениям и `features/
 * global-search`, тот же, что и в шапке сайта), а сайдвейс-импорт одной
 * фичи из другой запрещён границами FSD (см. AGENTS.md, «Правила
 * зависимостей»).
 *
 * Три источника результатов:
 *  - «Люди» — обычный поиск по пользователям Таверны (`useGlobalSearch`),
 *    без тех, с кем уже есть личный (не групповой) диалог — они и так
 *    найдутся ниже, в «Чатах», по имени, дублировать одного и того же
 *    человека в обеих группах незачем.
 *  - «Чаты» — свои диалоги, у которых синтезированное имя (участники, см.
 *    `Thread.name` в `entities/thread/api/map-thread.ts`) содержит запрос —
 *    сравнение на фронте, все диалоги и так уже загружены в сторе, отдельный
 *    backend-запрос не нужен. Так находится групповой чат по имени любого
 *    участника, даже если в сообщениях этого имени нет.
 *  - Сообщения внутри «Чатов» — прежний backend-поиск по тексту
 *    (`useAllThreadsSearch`), слитый с диалогами выше по `threadId` в один
 *    список: один и тот же чат не должен появляться в результатах дважды.
 */
export function MessengerSearchModal({
  threads,
  onSelectMessage,
  onSelectThread,
  onSelectPerson,
  onClose,
}: MessengerSearchModalProps) {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const messageSearch = useAllThreadsSearch(query);
  const peopleSearch = useGlobalSearch(query);

  const chatMatches = useMemo((): ChatMatch[] => {
    if (!hasQuery) return [];
    const lowerQuery = trimmedQuery.toLowerCase();
    const byThreadId = new Map<string, ChatMatch>();

    for (const result of messageSearch.results) {
      const thread = threads.find((item) => item.id === result.threadId);
      if (thread) byThreadId.set(thread.id, { thread, messages: result.messages });
    }

    for (const thread of threads) {
      if (byThreadId.has(thread.id)) continue;
      if (thread.name.toLowerCase().includes(lowerQuery)) {
        byThreadId.set(thread.id, { thread, messages: [] });
      }
    }

    return [...byThreadId.values()];
  }, [hasQuery, trimmedQuery, messageSearch.results, threads]);

  const directThreadParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const thread of threads) {
      if (thread.isGroup) continue;
      for (const participant of thread.participants) ids.add(participant.id);
    }
    return ids;
  }, [threads]);

  const people = (peopleSearch.data?.users ?? []).filter(
    (user) => !directThreadParticipantIds.has(user.id),
  );

  const isLoading =
    hasQuery && (messageSearch.status === 'loading' || peopleSearch.status === 'loading');
  const hasError = messageSearch.status === 'error' || peopleSearch.status === 'error';
  const hasResults = chatMatches.length > 0 || people.length > 0;

  return (
    <Modal onClose={onClose} label="Поиск" className={styles.search}>
      <h2 className={styles['search__title']}>Поиск</h2>

      <input
        autoFocus
        type="search"
        className={styles['search__input']}
        placeholder="Люди, чаты, сообщения…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {!hasQuery && (
        <EmptyState
          className={styles['search__state']}
          title="Введите запрос"
          description="Найдите чат, сообщение или человека, с которым ещё нет переписки."
        />
      )}

      {hasQuery && isLoading && !hasResults && (
        <Loader label="Ищем…" className={styles['search__state']} />
      )}

      {hasQuery && !isLoading && hasError && !hasResults && (
        <ErrorState
          message={messageSearch.error ?? peopleSearch.error}
          className={styles['search__state']}
        />
      )}

      {hasQuery && !isLoading && !hasError && !hasResults && (
        <EmptyState
          className={styles['search__state']}
          title="Ничего не нашли"
          description="Попробуйте другой запрос."
        />
      )}

      {hasQuery && hasResults && (
        <div className={styles['search__sections']}>
          {people.length > 0 && (
            <section className={styles['search__section']}>
              <h3 className={styles['search__section-title']}>Люди</h3>
              <div className={styles['search__people']}>
                {people.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={styles['search__person']}
                    onClick={() =>
                      onSelectPerson({
                        id: user.id,
                        name: user.name,
                        initials: user.initials,
                        avatarUrl: user.avatarUrl,
                      })
                    }
                  >
                    <Avatar initials={user.initials} src={user.avatarUrl} size="sm" />
                    <span className={styles['search__person-body']}>
                      <span className={styles['search__person-name']}>{user.name}</span>
                      <span className={styles['search__person-subtitle']}>
                        {user.tagline || 'пока без подписи'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {chatMatches.length > 0 && (
            <section className={styles['search__section']}>
              <h3 className={styles['search__section-title']}>Чаты</h3>
              <div className={styles['search__groups']}>
                {chatMatches.map(({ thread, messages }) => (
                  <div key={thread.id} className={styles['search__group']}>
                    <button
                      type="button"
                      className={styles['search__group-head']}
                      onClick={() => onSelectThread(thread.id)}
                    >
                      <Avatar initials={thread.initials} src={thread.avatarUrl} size="sm" />
                      <span className={styles['search__group-name']}>{thread.name}</span>
                    </button>
                    {messages.map((message) => (
                      <button
                        key={message.id}
                        type="button"
                        className={styles['search__result']}
                        onClick={() => onSelectMessage(thread.id, message.id)}
                      >
                        <span className={styles['search__result-text']}>
                          {message.text || 'Вложение'}
                        </span>
                        <span className={styles['search__result-time']}>
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
