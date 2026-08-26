'use client';

import { useEffect, useRef, useState } from 'react';
import { type ChatMessage, searchThreadMessages } from '@/entities/thread';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

const DEBOUNCE_MS = 300;

export interface UseThreadSearchResult {
  status: AsyncStatus;
  messages: ChatMessage[];
  error: string | null;
}

interface FetchResult {
  query: string;
  status: 'success' | 'error';
  messages: ChatMessage[];
  error: string | null;
}

/**
 * Поиск по тексту сообщений внутри одного открытого чата — тот же приём,
 * что и `features/global-search/model/use-global-search.ts` (`loading` не
 * отдельное состояние, а производное от сравнения текущего debounced-запроса
 * с запросом последнего завершённого ответа — так `setState` вызывается
 * только из колбэков промиса, а не синхронно в теле эффекта).
 */
export function useThreadSearch(threadId: string, query: string): UseThreadSearchResult {
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const [result, setResult] = useState<FetchResult | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!debouncedQuery) return;

    const requestId = ++requestIdRef.current;

    searchThreadMessages(threadId, debouncedQuery)
      .then((messages) => {
        if (requestIdRef.current === requestId) {
          setResult({ query: debouncedQuery, status: 'success', messages, error: null });
        }
      })
      .catch((error: unknown) => {
        if (requestIdRef.current === requestId) {
          setResult({
            query: debouncedQuery,
            status: 'error',
            messages: [],
            error: error instanceof Error ? error.message : 'Не удалось выполнить поиск',
          });
        }
      });
  }, [threadId, debouncedQuery]);

  if (!debouncedQuery) return { status: 'idle', messages: [], error: null };
  if (!result || result.query !== debouncedQuery) {
    return { status: 'loading', messages: result?.messages ?? [], error: null };
  }
  return { status: result.status, messages: result.messages, error: result.error };
}
