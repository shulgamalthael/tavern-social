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

    // `rootMargin` расширяет область срабатывания на 400px вниз за пределы
    // реального вьюпорта — без этого нулевой высоты `sentinel` в некоторых
    // раскладках оказывается на доли пикселя ниже видимой области даже в
    // максимально проскролленном состоянии (сумма дробных высот строк
    // округляется иначе, чем `scrollHeight`), и `IntersectionObserver`
    // никогда не срабатывает — подгрузка следующей страницы молча замирает
    // на первой. Заодно UX лучше: следующая страница подгружается заранее,
    // не точно у самого края.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  return sentinelRef;
}
