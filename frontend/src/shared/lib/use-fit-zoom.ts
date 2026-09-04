'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

export interface FitZoomResult {
  /** Повесить на прокручиваемый/центрирующий контейнер, ширина которого и
   * есть «доступное место» для рамки — `useFitZoom` следит именно за его
   * шириной (за вычетом собственного горизонтального padding), не за
   * шириной окна браузера. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Итоговый зум: `fitZoom`, пока `isFitted`, иначе 1 (100%). */
  zoom: number;
  /** Во сколько раз рамка уменьшена, чтобы поместиться целиком — 1, если
   * помещается без уменьшения. Нужен отдельно от `zoom`, чтобы показать
   * «68%» даже когда пользователь сейчас смотрит на 100% (переключился) и
   * дать вернуться обратно к тому же числу, а не к абстрактному «уместить». */
  fitZoom: number;
  isFitted: boolean;
  toggleFit: () => void;
}

/**
 * Вписывает элемент фиксированной ширины `frameWidth` (px — реальная ширина
 * desktop/tablet/mobile-раскладки) в доступную ширину контейнера через CSS
 * `zoom`, не `transform: scale`. `zoom` — layout-affecting свойство: браузер
 * пересчитывает сам layout и координаты pointer-событий/`getBoundingClientRect`
 * ПОСЛЕ его применения, поэтому масштаб остаётся согласован с реальными
 * координатами указателя. `transform` меняет только отрисовку поверх уже
 * посчитанного layout — на канвасе билдера внутри масштабируемой рамки
 * работает dnd-kit (`useSortable`/`useDraggable`), чья арифметика
 * перетаскивания опирается на эти самые координаты, поэтому только `zoom`
 * безопасен и для канваса (где есть drag&drop), и для превью (где его нет) —
 * один и тот же приём в обоих местах, а не два разных.
 *
 * Смена `frameWidth` (переключение вьюпорта desktop/tablet/mobile) сбрасывает
 * ручной выбор пользователя обратно на «по размеру» — переключились на
 * другой вьюпорт, значит хотят увидеть его целиком, а не унаследованный от
 * предыдущего вьюпорта 100%.
 */
export function useFitZoom(frameWidth: number): FitZoomResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fitZoom, setFitZoom] = useState(1);
  const [isFitted, setIsFitted] = useState(true);

  // Сброс ручного 100% обратно на «по размеру» при смене вьюпорта — во
  // время рендера сравнением с предыдущим `frameWidth`, тот же приём, что
  // `autoPanedFor` в `WebsiteBuilderWidget.tsx`/`trackedResetKey` в
  // `FieldGroup.tsx`, а не эффект: `setState` синхронно в эффекте без
  // внешней подписки — лишний повторный рендер там, где можно обойтись без
  // него (`react-hooks/set-state-in-effect`).
  const [trackedFrameWidth, setTrackedFrameWidth] = useState(frameWidth);
  if (trackedFrameWidth !== frameWidth) {
    setTrackedFrameWidth(frameWidth);
    setIsFitted(true);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const recompute = () => {
      const style = getComputedStyle(container);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const available = container.clientWidth - paddingX;
      setFitZoom(available > 0 ? Math.min(1, available / frameWidth) : 1);
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [frameWidth]);

  return {
    containerRef,
    zoom: isFitted ? fitZoom : 1,
    fitZoom,
    isFitted,
    toggleFit: () => setIsFitted((prev) => !prev),
  };
}
