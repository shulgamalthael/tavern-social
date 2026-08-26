import type { PublicProfile } from '@/modules/users/users.types';

export interface MessageAttachmentDto {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

/** Кто и что переслал — снимок на момент пересылки (имя отправителя
 * оригинала может с тех пор смениться, но здесь всегда то, что было тогда,
 * тот же принцип, что и у скопированного `text`, см. `ThreadsService.forwardMessage`). */
export interface ForwardedFromDto {
  id: string;
  senderId: string;
  senderName: string;
}

/** На что отвечает сообщение — в отличие от `ForwardedFromDto`, это не
 * снимок на момент ответа, а живая ссылка: `text`/`senderName` отражают
 * текущее состояние оригинала на момент запроса (если его отредактируют —
 * цитата в ответе поменяется вместе с ним, тот же принцип, что у обычной
 * ссылки в отличие от копии). `hasAttachment` — только флаг, не сами
 * вложения: цитате достаточно знать, что показать «Вложение» вместо
 * пустого текста, полный список вложений оригинала для этого не нужен. */
export interface ReplyToDto {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hasAttachment: boolean;
}

export interface MessageDto {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  attachments: MessageAttachmentDto[];
  forwardedFrom: ForwardedFromDto | null;
  replyTo: ReplyToDto | null;
}

export interface ThreadDto {
  id: string;
  /** Все участники диалога, кроме текущего пользователя — один для 1:1,
   * несколько для группового диалога (см. `ThreadsService.addParticipant`). */
  participants: PublicProfile[];
  isGroup: boolean;
  /** Для 1:1 — присутствие собеседника ("здесь" / "не в зале сейчас"),
   * для группы — количество участников. */
  status: string;
  unreadCount: number;
  messages: MessageDto[];
  /** Закреплённые сообщения треда, отсортированы по времени закрепления
   * (новые сверху) — их обычно немного, отдельного лимита/пагинации нет. */
  pinnedMessages: MessageDto[];
}
