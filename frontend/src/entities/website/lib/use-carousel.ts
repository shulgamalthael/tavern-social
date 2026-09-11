'use client';

import { useCallback, useEffect, useState } from 'react';

export interface UseCarouselResult {
  active: number;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * Общий "текущий слайд + автопрокрутка" движок для трёх блоков сразу
 * (`imagecarousel`/`imagecarouselthumbs`, `blocks/media`; `testimonialsslider`,
 * `blocks/business`) — раньше было бы три копии одного и того же `useState`+
 * `useEffect`+`setInterval`, тот же случай реального дублирования, что
 * `lib/entity-search.ts`/`lib/countdown.ts` уже выносили в отдельный модуль.
 *
 * `goTo` заворачивает индекс по модулю в обе стороны (`next()` с последнего
 * слайда уходит на первый, `prev()` с первого — на последний), так что
 * вызывающему рендереру не нужно самому думать о границах.
 *
 * Намеренно НЕТ эффекта, подрезающего `active` при уменьшении `itemCount` —
 * рендерер сам обязан отработать `items[active] ?? items[0]` (тот же приём,
 * что уже есть у `tabs`/`tabsvertical`, `blocks/content/index.tsx`), а не
 * эта общая логика: синхронный `setState` в теле эффекта только ради этого
 * упёрся бы в `react-hooks/set-state-in-effect` ради редкого края (владелец
 * удалил слайд, пока кто-то смотрит сайт), не стоящего того.
 */
export function useCarousel(
  itemCount: number,
  autoPlay: boolean,
  intervalSeconds: number,
): UseCarouselResult {
  const [active, setActive] = useState(0);

  const goTo = useCallback(
    (index: number) => {
      if (itemCount === 0) return;
      setActive(((index % itemCount) + itemCount) % itemCount);
    },
    [itemCount],
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (!autoPlay || itemCount <= 1) return;
    const id = setInterval(
      () => setActive((current) => (current + 1) % itemCount),
      Math.max(2, intervalSeconds) * 1000,
    );
    return () => clearInterval(id);
  }, [autoPlay, itemCount, intervalSeconds]);

  return { active, goTo, next, prev };
}
