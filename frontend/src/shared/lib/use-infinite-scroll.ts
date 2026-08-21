'use client';

import { useEffect, useRef } from 'react';

/**
 * Общий приём курсорной бесконечной прокрутки — невидимый «часовой» в конце
 * списка, `loadMore()` вызывается, когда он попадает во вьюпорт (первое место
 * в проекте с этим приёмом — `NotificationsWidget`, здесь он вынесен в общий
 * хук, чтобы каждый новый паginируемый список не копировал те же 10 строк
 * `IntersectionObserver`). `nextCursor` — `null`/`undefined` значит «дальше
 * страниц нет», наблюдатель в этом случае не заводится.
 *
 * Возвращает `ref`, который нужно повесить на пустой элемент в самом конце
 * списка: `<div ref={sentinelRef} aria-hidden="true" />`.
 */
export function useInfiniteScroll(
  nextCursor: string | null | undefined,
  loadMore: () => void,
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  return sentinelRef;
}
