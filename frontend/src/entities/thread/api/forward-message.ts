'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ChatMessage } from '../model/types';
import type { MessageResponse } from './map-thread';

/** Пересылающий всегда становится отправителем новой записи в целевом
 * треде (см. backend `ThreadsService.forwardMessage`) — `mine: true` без
 * отдельного похода за currentUserId, тот же приём, что и в `send-message.ts`. */
export async function forwardMessage(
  sourceThreadId: string,
  messageId: string,
  targetThreadId: string,
): Promise<ChatMessage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const message = await backendFetch<MessageResponse>(
    `/threads/${sourceThreadId}/messages/${messageId}/forward`,
    { method: 'POST', token, body: { targetThreadId } },
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
