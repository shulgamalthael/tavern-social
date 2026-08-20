'use client';

import { useEffect, useState } from 'react';

/** Возвращает `value`, но обновляется не раньше, чем через `delayMs` без новых изменений. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
