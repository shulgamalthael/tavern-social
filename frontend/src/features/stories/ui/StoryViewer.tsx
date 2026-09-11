'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StoryGroup, StoryViewerEntry } from '@/entities/story';
import { cn } from '@/shared/lib/cn';
import { formatMessageTime } from '@/shared/lib/format-message-time';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { CloseIcon, EyeIcon, TrashIcon } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import styles from './StoryViewer.module.scss';

/** Сколько показывается один слайд — тот же темп, что в Instagram. */
const SLIDE_SECONDS = 5;

export interface StoryViewerProps {
  groups: StoryGroup[];
  startGroupIndex: number;
  currentUserId: string;
  onClose: () => void;
  /** Переход на профиль автора — переход из просмотрщика всегда закрывает
   * его сам (см. вызывающего, `StoriesTray`), компонент об этом не знает. */
  onAuthorClick?: (userId: string) => void;
  /** Отметить историю просмотренной — сетевой вызов и обновление своего
   * списка (стор ленты или локальное состояние чужого профиля) — забота
   * вызывающего, сам просмотрщик не знает, откуда взялись `groups` (тот же
   * принцип, что у `MessageBubble`'s колбэков). Вызывается один раз на
   * историю, не на каждый повторный показ. */
  onStoryViewed: (storyId: string) => void;
  /** Удалить свою историю — кнопка видна только когда `group.author.id ===
   * currentUserId`. Не передан — кнопки удаления просто нет (чужой профиль,
   * где своих историй быть не может). */
  onStoryDeleted?: (storyId: string) => void;
  /** Список просмотревших — только для своих историй, подгружается лениво
   * по клику на «Посмотрели». Не передан — блок не показывается вовсе. */
  onLoadViewers?: (storyId: string) => Promise<StoryViewerEntry[]>;
}

/**
 * Полноэкранный просмотрщик историй — по образцу `shared/ui/ImageLightbox`
 * (портал в `document.body`, та же причина: `position: fixed` иначе
 * красится под доком навигации), но с собственной бизнес-логикой
 * (автопролистывание, отметка просмотра), поэтому не переиспользует сам
 * lightbox, а живёт в `features/stories`.
 */
export function StoryViewer({
  groups,
  startGroupIndex,
  currentUserId,
  onClose,
  onAuthorClick,
  onStoryViewed,
  onStoryDeleted,
  onLoadViewers,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[] | null>(null);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Увеличивается при отмене удаления, чтобы заново перезапустить прогресс
  // текущего слайда (часть ключа `<div>`-заливки ниже) — простое снятие
  // паузы вместо этого доигрывало бы с того же места, где стояло, а раз
  // пользователь уже успел открыть диалог подтверждения, слайд мог к этому
  // моменту почти доиграть, и снятие паузы тут же завершило бы анимацию и
  // сразу перелистнуло/закрыло бы просмотрщик — незаметно для пользователя.
  const [progressRestartToken, setProgressRestartToken] = useState(0);
  const viewedRef = useRef<Set<string>>(new Set());

  const group = groups[groupIndex] as StoryGroup | undefined;
  const story = group?.stories[storyIndex];
  const isOwnGroup = group?.author.id === currentUserId;

  const findNextGroupIndex = (from: number): number => {
    for (let i = from + 1; i < groups.length; i++) {
      if (groups[i].stories.length > 0) return i;
    }
    return -1;
  };
  const findPrevGroupIndex = (from: number): number => {
    for (let i = from - 1; i >= 0; i--) {
      if (groups[i].stories.length > 0) return i;
    }
    return -1;
  };

  // Панель «посмотрели» — состояние конкретного слайда, сбрасываем прямо в
  // обработчиках перехода (не через эффект на `story?.id` — синхронный
  // `setState` в эффекте лишь ради сброса другого стейта — антипаттерн,
  // см. `react-hooks/set-state-in-effect`).
  const resetViewersPanel = () => {
    setViewersOpen(false);
    setViewers(null);
  };

  const goNext = () => {
    if (!group) return;
    resetViewersPanel();
    if (storyIndex + 1 < group.stories.length) {
      setStoryIndex(storyIndex + 1);
      return;
    }
    const next = findNextGroupIndex(groupIndex);
    if (next === -1) {
      onClose();
      return;
    }
    setGroupIndex(next);
    setStoryIndex(0);
  };

  const goPrev = () => {
    resetViewersPanel();
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      return;
    }
    const prev = findPrevGroupIndex(groupIndex);
    if (prev === -1) return;
    setGroupIndex(prev);
    setStoryIndex(groups[prev].stories.length - 1);
  };

  useEffect(() => {
    if (!story || story.isMine || viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    onStoryViewed(story.id);
  }, [story, onStoryViewed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goPrev/goNext не мемоизированы, пересоздаются каждый рендер — перечисление их как deps привело бы к бессмысленному re-attach на каждый рендер; вместо этого реагируем на то, что реально меняет их поведение
  }, [groupIndex, storyIndex, groups, onClose]);

  const openViewers = async () => {
    if (!story || !onLoadViewers) return;
    setViewersOpen(true);
    if (viewers) return;
    setViewersLoading(true);
    try {
      setViewers(await onLoadViewers(story.id));
    } finally {
      setViewersLoading(false);
    }
  };

  // Удаление в сторе/локальном состоянии вызывающего происходит асинхронно
  // (см. `onStoryDeleted`) — к моменту следующего рендера `groups` уже
  // короче на один элемент, поэтому нельзя просто звать `goNext()`: он
  // читает ЕЩЁ старую длину массива и может увести `storyIndex` за границу
  // нового (уже укороченного) списка. Вместо этого сразу считаем целевой
  // индекс по известной заранее новой длине.
  const handleDelete = () => {
    if (!story || !onStoryDeleted || !group) return;
    const remainingCount = group.stories.length - 1;
    onStoryDeleted(story.id);
    setDeleteConfirmOpen(false);
    resetViewersPanel();
    if (remainingCount === 0) {
      const next = findNextGroupIndex(groupIndex);
      if (next === -1) onClose();
      else {
        setGroupIndex(next);
        setStoryIndex(0);
      }
    } else if (storyIndex >= remainingCount) {
      setStoryIndex(remainingCount - 1);
    }
    // Иначе — тот же `storyIndex` уже указывает на следующий слайд после
    // сдвига массива влево, дополнительный переход не нужен.
  };

  // Открытие подтверждения ставит показ на паузу — иначе автопролистывание
  // (5с) может закрыть/сменить историю прямо под пальцем, пока пользователь
  // ещё решает; отмена возвращает воспроизведение.
  const openDeleteConfirm = () => {
    setPaused(true);
    setDeleteConfirmOpen(true);
  };
  const cancelDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setPaused(false);
    setProgressRestartToken((token) => token + 1);
  };

  // Долгое нажатие ставит на паузу БЕЗ перехода к следующей истории при
  // отпускании — обычный `onClick` на той же кнопке не различает короткий
  // тап и конец долгого удержания (оба порождают `click`), поэтому тут
  // ручной учёт длительности нажатия вместо `onClick`.
  const HOLD_THRESHOLD_MS = 250;
  const pressStartRef = useRef(0);
  const handlePressStart = () => {
    pressStartRef.current = Date.now();
    setPaused(true);
  };
  const handlePressEnd = (advance: () => void) => {
    setPaused(false);
    if (Date.now() - pressStartRef.current < HOLD_THRESHOLD_MS) advance();
  };

  if (!group || !story) return null;

  return createPortal(
    <div
      className={styles.viewer}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр историй"
      onClick={onClose}
    >
      <div className={styles.viewer__stage} onClick={(event) => event.stopPropagation()}>
        <div className={styles['viewer__progress-row']}>
          {group.stories.map((slide, index) => (
            <div
              key={index === storyIndex ? `${slide.id}-${progressRestartToken}` : slide.id}
              className={styles['viewer__progress-track']}
            >
              <div
                className={cn(
                  styles['viewer__progress-fill'],
                  index < storyIndex && styles['viewer__progress-fill--full'],
                  index === storyIndex && styles['viewer__progress-fill--active'],
                )}
                style={
                  index === storyIndex
                    ? {
                        animationDuration: `${SLIDE_SECONDS}s`,
                        animationPlayState: isPaused ? 'paused' : 'running',
                      }
                    : undefined
                }
                onAnimationEnd={index === storyIndex ? goNext : undefined}
              />
            </div>
          ))}
        </div>

        <div className={styles.viewer__header}>
          <button
            type="button"
            className={styles['viewer__author']}
            onClick={() => onAuthorClick?.(group.author.id)}
          >
            <Avatar initials={group.author.initials} src={group.author.avatarUrl} size="sm" />
            <span className={styles['viewer__author-name']}>{group.author.name}</span>
            <span className={styles['viewer__time']}>{formatMessageTime(story.createdAt)}</span>
          </button>
          <button
            type="button"
            className={styles['viewer__close']}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- полноэкранный просмотр истории, не подходит под статическую оптимизацию next/image */}
        <img src={story.imageUrl} alt="" className={styles.viewer__image} />

        <button
          type="button"
          className={styles['viewer__tap-zone--left']}
          aria-label="Предыдущая история"
          onMouseDown={handlePressStart}
          onMouseUp={() => handlePressEnd(goPrev)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(event) => {
            event.preventDefault();
            handlePressStart();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            handlePressEnd(goPrev);
          }}
        />
        <button
          type="button"
          className={styles['viewer__tap-zone--right']}
          aria-label="Следующая история"
          onMouseDown={handlePressStart}
          onMouseUp={() => handlePressEnd(goNext)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(event) => {
            event.preventDefault();
            handlePressStart();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            handlePressEnd(goNext);
          }}
        />

        {isOwnGroup && (
          <div className={styles.viewer__footer}>
            {onLoadViewers && (
              <button
                type="button"
                className={styles['viewer__viewers-toggle']}
                onClick={() => void openViewers()}
              >
                <EyeIcon className={styles['viewer__viewers-icon']} />
                Посмотрели
              </button>
            )}
            {onStoryDeleted && (
              <button
                type="button"
                className={styles['viewer__delete']}
                onClick={openDeleteConfirm}
                aria-label="Удалить историю"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}

        {deleteConfirmOpen && (
          <Modal onClose={cancelDeleteConfirm} label="Удалить историю">
            <div className={styles['viewer__delete-modal']}>
              <h2>Удалить историю?</h2>
              <p className={styles['viewer__delete-modal-hint']}>
                Необратимо: история пропадёт для всех, кто мог её увидеть.
              </p>
              <div className={styles['viewer__delete-modal-actions']}>
                <Button variant="outline" onClick={cancelDeleteConfirm}>
                  Отмена
                </Button>
                <Button className={styles['viewer__delete-modal-danger']} onClick={handleDelete}>
                  Удалить
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {viewersOpen && (
          <div className={styles['viewer__viewers-panel']}>
            {viewersLoading && <span className={styles['viewer__viewers-empty']}>Загружаем…</span>}
            {!viewersLoading && viewers?.length === 0 && (
              <span className={styles['viewer__viewers-empty']}>Пока никто не посмотрел</span>
            )}
            {!viewersLoading &&
              viewers?.map((entry) => (
                <div key={entry.viewer.id} className={styles['viewer__viewer-row']}>
                  <Avatar initials={entry.viewer.initials} src={entry.viewer.avatarUrl} size="sm" />
                  <span className={styles['viewer__viewer-name']}>{entry.viewer.name}</span>
                  <span className={styles['viewer__viewer-time']}>
                    {formatMessageTime(entry.viewedAt)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
