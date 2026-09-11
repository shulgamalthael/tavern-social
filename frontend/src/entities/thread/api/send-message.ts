'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ChatMessage } from '../model/types';
import { mapSharedPost, type MessageResponse } from './map-thread';

/** `text` — опционален (сообщение может состоять только из вложений или
 * шаренного поста, см. `SendMessageDto` на backend), `files` —
 * картинки/файлы до 5 МБ каждый, backend проверяет тип/размер сам как
 * последний рубеж (см. `common/lib/upload.ts`,
 * `createChatAttachmentMulterOptions`) поверх клиентской проверки в
 * композере. Один multipart-запрос всегда, даже без файлов — тот же приём,
 * что и у `createPost`. `replyToId` — id сообщения В ЭТОМ ЖЕ треде, на
 * которое отвечают (см. `useThreadStore.replyingTo`). `sharedPostId` —
 * «Переслать пост в чат» (`entities/post`'s `useShareModalStore`,
 * `features/share-post`) — backend сам проверяет, что отправитель ещё
 * видит этот пост (`PostsService.getShareSummary`), здесь этого не
 * дублируем. */
export async function sendMessage(
  threadId: string,
  text: string,
  files: File[] = [],
  replyToId?: string,
  sharedPostId?: string,
): Promise<ChatMessage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  if (text) formData.append('text', text);
  if (replyToId) formData.append('replyToId', replyToId);
  if (sharedPostId) formData.append('sharedPostId', sharedPostId);
  files.forEach((file) => formData.append('files', file));

  const message = await backendUpload<MessageResponse>(`/threads/${threadId}/messages`, {
    token,
    formData,
  });
  // Сообщение только что отправлено текущим пользователем — оно точно
  // «моё» (в отличие от `mapMessage`, здесь не нужен отдельный запрос за
  // currentUserId только ради сравнения senderId с самим собой).
  return {
    id: message.id,
    mine: true,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    pinnedAt: message.pinnedAt,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      sizeBytes: attachment.sizeBytes,
    })),
    forwardedFrom: message.forwardedFrom,
    replyTo: message.replyTo,
    sharedPost: mapSharedPost(message.sharedPost),
  };
}
