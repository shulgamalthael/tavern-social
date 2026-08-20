'use client';

import { useEffect, useRef, useState } from 'react';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { search } from '../api/search';
import type { SearchResult } from './types';

const DEBOUNCE_MS = 300;

export interface UseGlobalSearchResult {
  status: AsyncStatus;
  data: SearchResult | null;
  error: string | null;
}

interface FetchResult {
  query: string;
  status: 'success' | 'error';
  data: SearchResult | null;
  error: string | null;
}

/**
 * Не используем `useAsyncData` — тот всегда стартует с `loading` и грузит
 * сразу при монтировании, а здесь пустой запрос не должен ничего запрашивать
 * (см. AGENTS.md, раздел про поиск). `loading` — не отдельное состояние,
 * а производное от сравнения текущего debounced-запроса с запросом
 * последнего завершённого ответа: пока они не совпадают, идёт загрузка.
 * Так `setState` внутри эффекта вызывается только из колбэков промиса, а не
 * синхронно в теле эффекта (react-hooks/set-state-in-effect). Гвард по
 * `requestId` защищает от того, что более старый ответ перезапишет более
 * новый при быстром вводе.
 */
export function useGlobalSearch(query: string): UseGlobalSearchResult {
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const [result, setResult] = useState<FetchResult | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!debouncedQuery) return;

    const requestId = ++requestIdRef.current;

    search(debouncedQuery)
      .then((data) => {
        if (requestIdRef.current === requestId) {
          setResult({ query: debouncedQuery, status: 'success', data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (requestIdRef.current === requestId) {
          setResult({
            query: debouncedQuery,
            status: 'error',
            data: null,
            error: error instanceof Error ? error.message : 'Не удалось выполнить поиск',
          });
        }
      });
  }, [debouncedQuery]);

  if (!debouncedQuery) return { status: 'idle', data: null, error: null };
  if (!result || result.query !== debouncedQuery) {
    return { status: 'loading', data: result?.data ?? null, error: null };
  }
  return { status: result.status, data: result.data, error: result.error };
}
