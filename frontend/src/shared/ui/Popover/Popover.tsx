'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './Popover.module.scss';

export interface PopoverTriggerState {
  open: boolean;
  toggle: () => void;
}

export interface PopoverContentState {
  close: () => void;
}

export interface PopoverProps {
  /** Рендерит САМ кликабельный элемент (обычно `<button>`) — `Popover` не
   * оборачивает его своей кнопкой, чтобы вызывающий мог поставить свой
   * `aria-expanded`/бейдж/иконку без вложенных `<button>` (тот же повод, что
   * у `LibraryItem` в билдере — вложенный `<button>` внутри `<button>`
   * невалиден и ловится React как ошибка гидратации). */
  trigger: (state: PopoverTriggerState) => ReactNode;
  /** Содержимое панели — функция получает `close`, чтобы закрыть попап после
   * своего действия (например, клик по результату поиска или успешный
   * чекаут), не поднимая состояние открытости наверх. */
  children: (state: PopoverContentState) => ReactNode;
  /** С какого края триггера растёт панель — `end` для крайних правых кнопок
   * шапки (иначе панель вылезет за правый край экрана). */
  align?: 'start' | 'end';
  panelClassName?: string;
  panelLabel: string;
}

/**
 * Лёгкий якорный поповер — общий для кнопок шапки сайта (поиск/избранное/
 * корзина/профиль, `HeaderActions.tsx`) паттерн, до сих пор существовавший
 * только как повторенный вручную код закрытия по клику-вне/Escape в
 * `widgets/header/ui/Header.tsx` (`NotificationsDropdown`/`SearchDropdown`)
 * — здесь тот же приём (слушатель на `document`, проверка `contains`),
 * вынесенный в переиспользуемый примитив. Не `Modal` (та — полноэкранная,
 * по центру) — этот попап растёт от конкретной кнопки-иконки.
 */
export function Popover({
  trigger,
  children,
  align = 'start',
  panelClassName,
  panelLabel,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    // Фаза перехвата (`capture: true`) + `stopPropagation` — попап может
    // оказаться внутри `PreviewModal.tsx`, у которой СВОЙ Escape-обработчик
    // тоже висит на `document` (закрывает весь предпросмотр). Оба слушателя
    // висят на одном и том же `document`, поэтому обычный `bubble`-порядок
    // не спасает: слушатель `PreviewModal` регистрируется раньше (при
    // монтировании модалки) и всегда сработал бы первым. Фаза перехвата
    // гарантированно выполняется до фазы всплытия для одного и того же
    // элемента, независимо от порядка регистрации — Escape закрывает только
    // попап, не утекает наверх и не закрывает случайно ещё и Preview.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div
          role="dialog"
          aria-label={panelLabel}
          className={cn(styles.panel, styles[`panel--${align}`], panelClassName)}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
