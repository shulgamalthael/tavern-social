'use client';

import {
  type HTMLAttributes,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './ScrollArea.module.scss';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Класс на сам прокручиваемый узел (padding/gap/display содержимого) —
   * `className` из `HTMLAttributes` идёт на внешнюю обёртку (размеры:
   * height/flex/max-width и т. п.), чтобы обёртка занимала то же место в
   * лейауте, что раньше занимал единственный `overflow: auto`-элемент. */
  viewportClassName?: string;
  /** Ref на сам прокручиваемый узел — например, чтобы позвать `scrollTo()`
   * извне (автоскролл к последнему сообщению в чате). */
  viewportRef?: Ref<HTMLDivElement>;
}

interface ThumbGeometry {
  size: number;
  offset: number;
}

const HIDE_DELAY_MS = 800;
const MIN_THUMB_SIZE = 24;

/**
 * Полностью кастомный скролл — не полагается на `scrollbar-width`/
 * `::-webkit-scrollbar` (они по-разному выглядят в разных браузерах, см.
 * `AGENTS.md`, раздел про CSS). Настоящая прокрутка (колесо мыши/тачпад/тач)
 * остаётся нативной на внутреннем `overflow-y: auto`-узле — нативный
 * scrollbar только визуально скрыт, вместо него рисуется свой тонкий
 * ползунок, синхронизированный со `scrollTop`, с перетаскиванием мышью.
 * В покое прозрачный, проявляется при наведении на область или во время
 * скролла (жест тачпадом/колесом без наведения — тоже считается «в
 * использовании»).
 */
export function ScrollArea({
  children,
  className,
  viewportClassName,
  viewportRef: externalViewportRef,
  ...rest
}: ScrollAreaProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Официальный React-способ отдать наружу ref на внутренний узел без
  // прямой мутации ref-пропа в колбэке (её не пропускает react-compiler
  // lint) — `useImperativeHandle` сам умеет и в функцию, и в RefObject.
  useImperativeHandle(externalViewportRef ?? null, () => viewportRef.current as HTMLDivElement);
  const [thumb, setThumb] = useState<ThumbGeometry | null>(null);
  const [isHovering, setHovering] = useState(false);
  const [isScrolling, setScrolling] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recompute = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { scrollHeight, clientHeight, scrollTop } = viewport;
    if (scrollHeight <= clientHeight + 1) {
      setThumb(null);
      return;
    }
    const size = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_SIZE);
    const maxOffset = clientHeight - size;
    const offset = maxOffset <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxOffset;
    setThumb({ size, offset });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    recompute();

    const onScroll = () => {
      recompute();
      setScrolling(true);
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = setTimeout(() => setScrolling(false), HIDE_DELAY_MS);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });

    // Содержимое может менять высоту без изменения размеров самого
    // viewport (например, новое сообщение в открытом чате) — следим и за
    // прямыми детьми, не только за самим контейнером.
    const observer = new ResizeObserver(recompute);
    observer.observe(viewport);
    Array.from(viewport.children).forEach((child) => observer.observe(child));

    return () => {
      viewport.removeEventListener('scroll', onScroll);
      observer.disconnect();
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);
    };
  }, [children, recompute]);

  useEffect(() => {
    if (!isDragging) return undefined;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return undefined;

    const onMouseMove = (event: MouseEvent) => {
      const { scrollHeight, clientHeight } = viewport;
      const trackRect = track.getBoundingClientRect();
      const size = thumb?.size ?? MIN_THUMB_SIZE;
      const maxOffset = trackRect.height - size;
      if (maxOffset <= 0) return;
      const relativeY = event.clientY - trackRect.top - size / 2;
      const ratio = Math.min(1, Math.max(0, relativeY / maxOffset));
      viewport.scrollTop = ratio * (scrollHeight - clientHeight);
    };
    const onMouseUp = () => setDragging(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, thumb?.size]);

  const isThumbVisible = isHovering || isScrolling || isDragging;

  return (
    <div
      {...rest}
      className={cn(styles['scroll-area'], className)}
      onMouseEnter={(event) => {
        setHovering(true);
        rest.onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setHovering(false);
        rest.onMouseLeave?.(event);
      }}
    >
      <div className={cn(styles['scroll-area__viewport'], viewportClassName)} ref={viewportRef}>
        {children}
      </div>
      {thumb && (
        <div className={styles['scroll-area__track']} ref={trackRef}>
          <div
            className={cn(
              styles['scroll-area__thumb'],
              isThumbVisible && styles['scroll-area__thumb--visible'],
              isDragging && styles['scroll-area__thumb--dragging'],
            )}
            style={{ height: thumb.size, transform: `translateY(${thumb.offset}px)` }}
            onMouseDown={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
