'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { formatMessageTime } from '@/shared/lib/format-message-time';
import { formatFileSize } from '@/shared/lib/format-file-size';
import { isEmojiOnlyText } from '@/shared/lib/is-emoji-only-text';
import { cn } from '@/shared/lib/cn';
import { linkifyText } from '@/shared/lib/linkify-text';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import { CloseIcon, EditIcon, FileIcon, ForwardIcon, PinIcon, ReplyIcon } from '@/shared/ui/icons';
import type { ChatMessage } from '@/entities/thread';
import { SharedPostCard } from './SharedPostCard';
import styles from './MessageBubble.module.scss';

/** Долгое нажатие на мобильном открывает то же меню, что и «···»/правый
 * клик на десктопе — тот же порог, что обычно используют мобильные ОС для
 * long-press (заметно дольше обычного тапа, но не настолько долго, чтобы
 * казаться зависанием). */
const LONG_PRESS_MS = 500;

export interface MessageBubblePosition {
  /** Первое/среднее/последнее сообщение в цепочке подряд идущих сообщений
   * одного отправителя — определяет, какие углы «сглаживаются» к соседним
   * пузырям, как в Telegram (единственное сообщение — все углы круглые). */
  isFirstInCluster: boolean;
  isLastInCluster: boolean;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  position: MessageBubblePosition;
  /** Только для своих сообщений — вызывающий (`MessengerWidget`) решает,
   * передавать ли колбэк вообще, тот же принцип, что у `PostCard.onEdit`. */
  onEdit?: () => void;
  /** Тоже только свои — в отличие от «Ответить», удалить чужое сообщение
   * нельзя (не модерация, обычная переписка). */
  onDelete?: () => void;
  onForward?: () => void;
  /** Доступно на любом сообщении, не только своих — ответить можно и
   * собеседнику. */
  onReply?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  /** Клик по «Переслано от …» — переход на профиль автора оригинала. */
  onAuthorClick?: (userId: string) => void;
  /** Клик по цитате в ответе — скролл к сообщению, на которое отвечали. */
  onReplyQuoteClick?: (messageId: string) => void;
}

export function MessageBubble({
  message,
  position,
  onEdit,
  onDelete,
  onForward,
  onReply,
  onPin,
  onUnpin,
  onAuthorClick,
  onReplyQuoteClick,
}: MessageBubbleProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    },
    [],
  );

  const imageAttachments = message.attachments.filter((attachment) =>
    attachment.mimeType.startsWith('image/'),
  );
  const fileAttachments = message.attachments.filter(
    (attachment) => !attachment.mimeType.startsWith('image/'),
  );
  // «Стикер» — короткое сообщение из одних эмодзи, без вложений/пересылки
  // (см. `is-emoji-only-text.ts`) — рендерится крупно, без пузыря, как в
  // Telegram/WhatsApp; готового набора картинок для настоящих стикеров нет.
  const isSticker =
    message.attachments.length === 0 &&
    !message.forwardedFrom &&
    !message.sharedPost &&
    isEmojiOnlyText(message.text);
  const isSingleImage = imageAttachments.length === 1;

  const hasMenu = Boolean(
    onReply || onForward || onPin || onUnpin || (message.mine && (onEdit || onDelete)),
  );

  // Правый клик (десктоп) и долгое нажатие (тач) — дополнительные способы
  // открыть то же самое меню, что и клик по «···». Само меню всегда
  // остаётся в своей обычной позиции у бабла, а не «плавает» за курсором —
  // так проще и достаточно для «доп. меню по правому клику/зажатию».
  const onContextMenu = (event: MouseEvent) => {
    if (!hasMenu) return;
    event.preventDefault();
    setMenuOpen(true);
  };
  const onTouchStart = (_event: TouchEvent) => {
    if (!hasMenu) return;
    longPressTimer.current = setTimeout(() => setMenuOpen(true), LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      id={`message-${message.id}`}
      className={cn(styles['bubble-row'], message.mine && styles['bubble-row--mine'])}
    >
      {hasMenu && (
        <div className={styles['bubble-row__menu']} ref={menuRef}>
          <button
            type="button"
            className={styles['bubble-row__menu-trigger']}
            aria-label="Действия с сообщением"
            aria-expanded={isMenuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ···
          </button>
          {isMenuOpen && (
            <div className={styles['bubble-row__menu-popover']}>
              {onReply && (
                <button
                  type="button"
                  className={styles['bubble-row__menu-item']}
                  onClick={() => {
                    setMenuOpen(false);
                    onReply();
                  }}
                >
                  <ReplyIcon />
                  Ответить
                </button>
              )}
              {message.mine && onEdit && (
                <button
                  type="button"
                  className={styles['bubble-row__menu-item']}
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                >
                  <EditIcon />
                  Редактировать
                </button>
              )}
              {onForward && (
                <button
                  type="button"
                  className={styles['bubble-row__menu-item']}
                  onClick={() => {
                    setMenuOpen(false);
                    onForward();
                  }}
                >
                  <ForwardIcon />
                  Переслать
                </button>
              )}
              {message.pinnedAt
                ? onUnpin && (
                    <button
                      type="button"
                      className={styles['bubble-row__menu-item']}
                      onClick={() => {
                        setMenuOpen(false);
                        onUnpin();
                      }}
                    >
                      <PinIcon />
                      Открепить
                    </button>
                  )
                : onPin && (
                    <button
                      type="button"
                      className={styles['bubble-row__menu-item']}
                      onClick={() => {
                        setMenuOpen(false);
                        onPin();
                      }}
                    >
                      <PinIcon />
                      Закрепить
                    </button>
                  )}
              {message.mine && onDelete && (
                <button
                  type="button"
                  className={cn(
                    styles['bubble-row__menu-item'],
                    styles['bubble-row__menu-item--danger'],
                  )}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <CloseIcon />
                  Удалить
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isSticker ? (
        <div
          className={cn(styles.sticker, message.mine && styles['sticker--mine'])}
          onContextMenu={onContextMenu}
          onTouchStart={onTouchStart}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
        >
          <span className={styles.sticker__emoji}>{message.text}</span>
          <span className={styles.sticker__time}>{formatMessageTime(message.createdAt)}</span>
        </div>
      ) : (
        <div
          className={cn(
            styles.bubble,
            message.mine && styles['bubble--mine'],
            !position.isFirstInCluster && styles['bubble--joined-top'],
            !position.isLastInCluster && styles['bubble--joined-bottom'],
          )}
          onContextMenu={onContextMenu}
          onTouchStart={onTouchStart}
          onTouchEnd={cancelLongPress}
          onTouchMove={cancelLongPress}
        >
          {message.replyTo && (
            <button
              type="button"
              className={styles['bubble__reply-quote']}
              onClick={() => onReplyQuoteClick?.(message.replyTo!.id)}
            >
              <span className={styles['bubble__reply-quote-author']}>
                {message.replyTo.senderName}
              </span>
              <span className={styles['bubble__reply-quote-text']}>
                {message.replyTo.text || (message.replyTo.hasAttachment ? 'Вложение' : '')}
              </span>
            </button>
          )}

          {message.forwardedFrom && (
            <button
              type="button"
              className={styles['bubble__forwarded']}
              onClick={() => onAuthorClick?.(message.forwardedFrom!.senderId)}
            >
              <ForwardIcon />
              Переслано от {message.forwardedFrom.senderName}
            </button>
          )}

          {message.sharedPost && (
            <SharedPostCard sharedPost={message.sharedPost} onAuthorClick={onAuthorClick} />
          )}

          {imageAttachments.length > 0 && (
            <div
              className={cn(
                styles['bubble__images'],
                isSingleImage && styles['bubble__images--single'],
              )}
            >
              {imageAttachments.map((attachment, index) => (
                <button
                  key={attachment.id}
                  type="button"
                  className={cn(
                    styles['bubble__image-trigger'],
                    isSingleImage && styles['bubble__image-trigger--single'],
                  )}
                  onClick={() => setLightboxIndex(index)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- загруженное вложение чата, не подходит под статическую оптимизацию next/image */}
                  <img
                    src={attachment.url}
                    alt=""
                    className={cn(
                      styles['bubble__image'],
                      isSingleImage && styles['bubble__image--single'],
                    )}
                  />
                </button>
              ))}
            </div>
          )}

          {fileAttachments.length > 0 && (
            <div className={styles['bubble__files']}>
              {fileAttachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  download={attachment.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles['bubble__file']}
                >
                  <FileIcon className={styles['bubble__file-icon']} />
                  <span className={styles['bubble__file-body']}>
                    <span className={styles['bubble__file-name']}>{attachment.fileName}</span>
                    <span className={styles['bubble__file-size']}>
                      {formatFileSize(attachment.sizeBytes)}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}

          {message.text && <span className={styles.bubble__text}>{linkifyText(message.text)}</span>}

          <span className={styles.bubble__time}>
            {message.editedAt && <span className={styles['bubble__edited-mark']}>изменено · </span>}
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
      )}

      {lightboxIndex !== null && imageAttachments.length > 0 && (
        <ImageLightbox
          images={imageAttachments.map((attachment) => ({
            id: attachment.id,
            url: attachment.url,
          }))}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
