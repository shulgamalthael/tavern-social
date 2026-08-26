'use client';

import { useState } from 'react';
import { formatMessageTime } from '@/shared/lib/format-message-time';
import { CloseIcon, SearchIcon } from '@/shared/ui/icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useThreadSearch } from '../model/use-thread-search';
import styles from './ThreadSearchBar.module.scss';

export interface ThreadSearchBarProps {
  threadId: string;
  onSelectMessage: (messageId: string) => void;
  onClose: () => void;
}

/** Узкая поисковая панель под шапкой открытого чата — раскрывается по клику
 * на иконку поиска (см. `MessengerWidget.tsx`), результаты — тот же приём
 * скролла к сообщению, что и у закреплённых сообщений. */
export function ThreadSearchBar({ threadId, onSelectMessage, onClose }: ThreadSearchBarProps) {
  const [query, setQuery] = useState('');
  const { status, messages, error } = useThreadSearch(threadId, query);
  const trimmed = query.trim().length > 0;

  return (
    <div className={styles.bar}>
      <div className={styles['bar__row']}>
        <SearchIcon className={styles['bar__icon']} />
        <input
          autoFocus
          type="search"
          className={styles['bar__input']}
          placeholder="Поиск по этому чату…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className={styles['bar__close']}
          onClick={onClose}
          aria-label="Закрыть поиск"
        >
          <CloseIcon />
        </button>
      </div>

      {trimmed && (
        <ScrollArea
          className={styles['bar__results']}
          viewportClassName={styles['bar__results-viewport']}
        >
          {status === 'loading' && <Loader label="Ищем…" className={styles['bar__state']} />}
          {status === 'error' && <p className={styles['bar__error']}>{error}</p>}
          {status === 'success' && messages.length === 0 && (
            <EmptyState
              className={styles['bar__state']}
              title="Ничего не нашли"
              description="Попробуйте другой запрос."
            />
          )}
          {status === 'success' &&
            messages.map((message) => (
              <button
                key={message.id}
                type="button"
                className={styles['bar__result']}
                onClick={() => onSelectMessage(message.id)}
              >
                <span className={styles['bar__result-text']}>{message.text || 'Вложение'}</span>
                <span className={styles['bar__result-time']}>
                  {formatMessageTime(message.createdAt)}
                </span>
              </button>
            ))}
        </ScrollArea>
      )}
    </div>
  );
}
