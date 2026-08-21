'use client';

import { useEffect, type RefObject } from 'react';

const STORAGE_KEY = 'tavern-scroll-top';
// ~1.5с на 60fps — реальный контент раздела (посты, диалоги, друзья и т. д.)
// почти всегда успевает догрузиться и вырасти до нужной высоты за это время;
// если нет, просто останавливаемся на последней попытке, не листая вечно.
const MAX_RESTORE_ATTEMPTS = 90;

/**
 * Восстанавливает scrollTop контейнера после перезагрузки страницы (см.
 * задачу про сохранение раздела/вкладки — `useNavigationStore`, `persist`) и
 * непрерывно сохраняет его при скролле, чтобы на следующей перезагрузке
 * вернуться туда же. `sessionStorage`, как и раздел — «текущая вкладка», не
 * «навсегда».
 *
 * Целевая позиция часто недоступна сразу после монтирования — контент
 * раздела (посты/диалоги/друзья) ещё грузится и контейнер физически
 * недостаточно высок, чтобы проскроллиться так далеко. Поэтому попытка
 * повторяется на каждом кадре, пока контейнер не станет достаточно высоким
 * либо не кончится лимит попыток — без завязки на статус загрузки
 * конкретного стора (их слишком много и они независимы друг от друга).
 */
/** Сбрасывает сохранённую позицию скролла — вызывается при выходе из
 * аккаунта (`SettingsWidget`), чтобы следующий вход (тем же или другим
 * пользователем в этой вкладке) не унаследовал чужую точку прокрутки. */
export function clearPersistedScroll() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function usePersistedScroll(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const target = saved ? Number(saved) : 0;

    if (target > 0) {
      let attempts = 0;
      const tryRestore = () => {
        if (cancelled) return;
        container.scrollTop = target;
        attempts += 1;
        const reachable = container.scrollHeight - container.clientHeight >= target;
        if (!reachable && attempts < MAX_RESTORE_ATTEMPTS) {
          requestAnimationFrame(tryRestore);
        }
      };
      requestAnimationFrame(tryRestore);
    }

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!cancelled) sessionStorage.setItem(STORAGE_KEY, String(container.scrollTop));
        ticking = false;
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelled = true;
      container.removeEventListener('scroll', onScroll);
    };
  }, [containerRef]);
}
