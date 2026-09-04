'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery } from '@/shared/lib/use-media-query';

/**
 * Смещение фонового слоя `hero`'s `parallaxBackground` (см. её комментарий
 * в `blocks/business/index.tsx`) — картинка едет медленнее контента при
 * прокрутке. Читает `getBoundingClientRect().top` на каждом кадре, а не
 * слушает `scroll` на `window`: в Preview билдера и на самом сайте
 * прокрутка идёт внутри кастомного `ScrollArea` (свой JS-скроллбар поверх
 * спрятанного нативного — см. AGENTS.md), `scroll`-событие с вложенного
 * контейнера НЕ всплывает до `window`. `getBoundingClientRect()` не
 * зависит от того, где именно происходит сама прокрутка — всегда отдаёт
 * актуальную позицию элемента относительно вьюпорта.
 *
 * `requestAnimationFrame`-цикл идёт только пока блок реально в зоне
 * видимости (управляется `IntersectionObserver`) — не жжёт кадры и не
 * дёргает `setState` на каждый скролл где-то далеко от этого блока.
 *
 * DOM-узел хранится в `useState`, а не в `useRef` с обёрточным callback-
 * реф — та же причина, что у `useScrollReveal` (см. её комментарий):
 * React Compiler иначе помечает возвращаемый объект как «содержащий реф» и
 * запрещает читать `ref`/`offsetY` из результата хука во время рендера в
 * местах использования (`blocks/business/index.tsx`).
 */
export function useParallaxOffset(
  enabled: boolean,
  speed = 0.3,
): { ref: (node: HTMLDivElement | null) => void; offsetY: number } {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [offsetY, setOffsetY] = useState(0);
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || prefersReducedMotion || !element) return;

    let rafId = 0;

    function tick() {
      if (!element) return;
      setOffsetY(element.getBoundingClientRect().top * speed);
      rafId = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!rafId) rafId = requestAnimationFrame(tick);
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled, prefersReducedMotion, element, speed]);

  return { ref: setElement, offsetY: enabled ? offsetY : 0 };
}
