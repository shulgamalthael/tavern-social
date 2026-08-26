'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ChatMessage } from '../model/types';
import type { MessageResponse } from './map-thread';

/** Редактировать можно только своё сообщение (backend это и проверяет) —
 * поэтому `mine: true` всегда верно здесь, без отдельного похода за
 * currentUserId ради сравнения senderId с самим собой (тот же приём, что и
 * в `send-message.ts`). */
export async function editMessage(
  threadId: string,
  messageId: string,
  text: string,
): Promise<ChatMessage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const message = await backendFetch<MessageResponse>(
    `/threads/${threadId}/messages/${messageId}`,
    { method: 'PATCH', token, body: { text } },
  );

  return {
    id: message.id,
    mine: true,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    pinnedAt: message.pinnedAt,
    attachments: message.attachments,
    forwardedFrom: message.forwardedFrom,
    replyTo: message.replyTo,
  };
}
