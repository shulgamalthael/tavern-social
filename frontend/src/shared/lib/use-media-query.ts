'use client';

import { useSyncExternalStore } from 'react';

function subscribe(query: string, onStoreChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

/**
 * Реальная физическая ширина окна браузера (`window.matchMedia`) — не путать
 * с `store.viewport` в билдере сайтов (`entities/website`), который
 * симулирует чужой экран ВНУТРИ холста и не связан с тем, на каком реальном
 * устройстве сейчас открыт сам билдер. `useSyncExternalStore` — самое точное
 * применение этого хука: значение живёт вне React (сам `matchMedia`), а не
 * дублируется в состоянии компонента, поэтому не нужен ни `useEffect`, ни его
 * ловушки с гидратацией (снапшот сервера — всегда `false`, чтобы разметка
 * первого рендера совпадала на сервере и клиенте, и тут же уточняется сразу
 * после гидратации). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}
