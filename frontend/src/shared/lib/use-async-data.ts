'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AsyncStatus } from './async-status';

export interface AsyncDataState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: string | null;
  refetch: () => void;
}

/**
 * Загружает данные через `fetcher` и явно разделяет loading/error/success —
 * готово к подключению настоящего API: меняется только `fetcher`.
 * `fetcher` должен быть стабильной ссылкой (обычный экспорт из `api/*.ts`),
 * иначе запрос будет перезапускаться на каждый рендер.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>): AsyncDataState<T> {
  // Изначально всегда 'loading': эффект ниже запускает запрос сразу при
  // монтировании. Синхронный setState внутри самого эффекта не используем —
  // react-hooks/set-state-in-effect справедливо предупреждает о лишних
  // каскадных рендерах, поэтому переход в 'loading' при повторной загрузке
  // выполняется в `refetch` (обработчик события, а не тело эффекта).
  const [state, setState] = useState<Omit<AsyncDataState<T>, 'refetch'>>({
    status: 'loading',
    data: undefined,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            data: undefined,
            error: error instanceof Error ? error.message : 'Не удалось загрузить данные',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher, reloadToken]);

  const refetch = useCallback(() => {
    setState({ status: 'loading', data: undefined, error: null });
    setReloadToken((token) => token + 1);
  }, []);

  return { ...state, refetch };
}
