'use client';

import { useEffect, useRef, useState } from 'react';
import { searchAllThreads, type ThreadSearchResult } from '@/entities/thread';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

const DEBOUNCE_MS = 300;

export interface UseAllThreadsSearchResult {
  status: AsyncStatus;
  results: ThreadSearchResult[];
  error: string | null;
}

interface FetchResult {
  query: string;
  status: 'success' | 'error';
  results: ThreadSearchResult[];
  error: string | null;
}

/** Поиск по тексту сообщений сразу по всем диалогам текущего пользователя —
 * тот же приём, что и `use-thread-search.ts`/`use-global-search.ts`. */
export function useAllThreadsSearch(query: string): UseAllThreadsSearchResult {
  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const [result, setResult] = useState<FetchResult | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!debouncedQuery) return;

    const requestId = ++requestIdRef.current;

    searchAllThreads(debouncedQuery)
      .then((results) => {
        if (requestIdRef.current === requestId) {
          setResult({ query: debouncedQuery, status: 'success', results, error: null });
        }
      })
      .catch((error: unknown) => {
        if (requestIdRef.current === requestId) {
          setResult({
            query: debouncedQuery,
            status: 'error',
            results: [],
            error: error instanceof Error ? error.message : 'Не удалось выполнить поиск',
          });
        }
      });
  }, [debouncedQuery]);

  if (!debouncedQuery) return { status: 'idle', results: [], error: null };
  if (!result || result.query !== debouncedQuery) {
    return { status: 'loading', results: result?.results ?? [], error: null };
  }
  return { status: result.status, results: result.results, error: result.error };
}
