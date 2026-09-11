'use client';

import { useEffect, useRef, useState } from 'react';

export interface ScrollPosition {
  scrollTop: number;
  /** `0`, если контейнер вообще не может прокручиваться (контента меньше
   * высоты вьюпорта) — вызывающий должен трактовать это как «0%
   * прокручено», не делить на ноль. */
  scrollableHeight: number;
}

const ZERO_POSITION: ScrollPosition = { scrollTop: 0, scrollableHeight: 0 };

function resolveScrollTarget(node: HTMLElement): HTMLElement | Window {
  let current = node.parentElement;
  while (current) {
    const style = getComputedStyle(current);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return window;
}

function readPosition(target: HTMLElement | Window): ScrollPosition {
  if (target === window) {
    return {
      scrollTop: window.scrollY,
      scrollableHeight: document.documentElement.scrollHeight - window.innerHeight,
    };
  }
  const element = target as HTMLElement;
  return {
    scrollTop: element.scrollTop,
    scrollableHeight: element.scrollHeight - element.clientHeight,
  };
}

/**
 * Позиция РЕАЛЬНОГО прокручиваемого контейнера страницы — не обязательно
 * `window`: на публичном сайте и в Preview билдера прокрутка идёт внутри
 * кастомного `ScrollArea` (свой JS-скроллбар поверх спрятанного нативного,
 * см. `AGENTS.md` §6) — его `scroll`-событие НЕ всплывает до `window`
 * (тот же архитектурный факт, что уже решён `useParallaxOffset` через
 * `getBoundingClientRect()`; здесь другой приём, потому что нужна позиция
 * ВСЕЙ страницы целиком, не одного элемента — находим реальный
 * прокручиваемый предок по вычисленному `overflow-y`, а не гадаем заранее).
 * Найден вживую Playwright-проверкой (`scrollprogress`/`backtotop`,
 * партия виджетов №6): оба виджета изначально слушали `window`, что молча
 * не работало ни на одной реальной странице сайта.
 *
 * `ref` вешается на любой узел, который рендерит сам блок (даже
 * `position: fixed` — это только про отрисовку, не про место в DOM-дереве,
 * `parentElement` всё равно ведёт к настоящему `ScrollArea`).
 */
export function useScrollPosition(): {
  ref: (node: HTMLElement | null) => void;
  position: ScrollPosition;
  scrollToTop: () => void;
} {
  const [position, setPosition] = useState<ScrollPosition>(ZERO_POSITION);
  const [element, setElement] = useState<HTMLElement | null>(null);
  // Обычный `useRef`, не `useState` — `target` сам по себе не должен
  // вызывать перерендер (на вывод влияет только `position`), и мутация
  // рефа синхронно в теле эффекта не подпадает под `react-hooks/set-state-
  // in-effect` (в отличие от `setState`).
  const targetRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    if (!element) return;
    const resolved = resolveScrollTarget(element);
    targetRef.current = resolved;

    function handleScroll() {
      setPosition(readPosition(resolved));
    }

    // Первое чтение — в колбэке `queueMicrotask`, не синхронно в теле
    // эффекта (`react-hooks/set-state-in-effect`, тот же приём, что и у
    // остальных мест проекта, читающих реальное состояние окружения после
    // монтирования).
    queueMicrotask(handleScroll);
    resolved.addEventListener('scroll', handleScroll, { passive: true });
    return () => resolved.removeEventListener('scroll', handleScroll);
  }, [element]);

  function scrollToTop() {
    targetRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { ref: setElement, position, scrollToTop };
}
