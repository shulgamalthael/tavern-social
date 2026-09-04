'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useMediaQuery } from '@/shared/lib/use-media-query';
import type { BlockStyle } from '../model/types';

type EntranceAnimation = NonNullable<BlockStyle['entranceAnimation']>;

/** Начальное (скрытое) смещение до появления — куда «уезжает» блок обратно
 * при клике «назад» браузером не важно: анимация однократная (см. ниже),
 * откат состояния не происходит. `fade`/`none` не двигают, только меняют
 * `opacity`. */
const HIDDEN_TRANSFORM: Record<EntranceAnimation, string | undefined> = {
  none: undefined,
  fade: undefined,
  'slide-up': 'translateY(28px)',
  'slide-down': 'translateY(-28px)',
  'slide-left': 'translateX(32px)',
  'slide-right': 'translateX(-32px)',
  'zoom-in': 'scale(0.94)',
};

const TRANSITION = 'opacity 0.6s ease, transform 0.6s ease';

/**
 * Однократное появление блока при первой прокрутке до него
 * (`BlockStyle.entranceAnimation`/`entranceDelay`, см. их комментарий в
 * `model/types.ts`) — подключается ровно в одном месте, `BlockRenderer.tsx`
 * (публичный сайт и Preview билдера, один и тот же компонент на оба, см.
 * `WebsiteRenderer`), НЕ в `CanvasBlock.tsx` (канвас редактирования
 * сознательно без анимации — см. комментарий `entranceAnimation` в
 * `model/types.ts`).
 *
 * `IntersectionObserver` отключается после первого пересечения — эффект
 * «появилось один раз», не мигает при скролле вверх-вниз мимо блока (так
 * ведёт себя подавляющее большинство подобных эффектов на реальных
 * сайтах — не entrance-анимация заново на каждый заход в зону видимости).
 *
 * Начальное состояние (`isVisible`) считается ТОЛЬКО из `animation` —
 * никакого чтения `window`/`matchMedia` во время самого рендера: и на
 * сервере, и при самом первом клиентском рендере значение обязано
 * совпадать (иначе React ловит hydration mismatch). `prefers-reduced-motion`
 * читается через `useMediaQuery` (`shared/lib/use-media-query.ts`,
 * `useSyncExternalStore` с серверным снапшотом `false`) — тот же самый
 * SSR-безопасный приём, без ручного `useEffect`+`setState` для этой части.
 *
 * DOM-узел хранится в `useState`, а не в `useRef` с обёрточным callback-
 * реф: React Compiler иначе помечает весь возвращаемый объект как
 * «содержащий реф» и запрещает читать `ref`/`style` из результата хука во
 * время рендера в местах использования (`BlockRenderer.tsx`) — `useState`
 * для DOM-узла таких предупреждений не даёт и это официально
 * рекомендуемый паттерн для колбэк-рефов, за которыми нужно наблюдать
 * эффектом.
 */
export function useScrollReveal(
  animation: BlockStyle['entranceAnimation'],
  delayMs: number | undefined,
): { ref: (node: HTMLDivElement | null) => void; style: CSSProperties } {
  const isAnimationNone = !animation || animation === 'none';
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    if (isAnimationNone || prefersReducedMotion || !element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isAnimationNone, prefersReducedMotion, element]);

  if (isAnimationNone) {
    return { ref: setElement, style: {} };
  }

  const isVisible = hasIntersected || prefersReducedMotion;
  const hiddenTransform = HIDDEN_TRANSFORM[animation];
  return {
    ref: setElement,
    style: {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'none' : hiddenTransform,
      transition: TRANSITION,
      transitionDelay: delayMs ? `${delayMs}ms` : undefined,
    },
  };
}
