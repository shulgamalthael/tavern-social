'use client';

import { formatMessageTime } from '@/shared/lib/format-message-time';
import { cn } from '@/shared/lib/cn';
import type { ChatMessage } from '@/entities/thread';
import styles from './MessageBubble.module.scss';

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
}

export function MessageBubble({ message, position }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        styles.bubble,
        message.mine && styles['bubble--mine'],
        !position.isFirstInCluster && styles['bubble--joined-top'],
        !position.isLastInCluster && styles['bubble--joined-bottom'],
      )}
    >
      <span className={styles.bubble__text}>{message.text}</span>
      <span className={styles.bubble__time}>{formatMessageTime(message.createdAt)}</span>
    </div>
  );
}
