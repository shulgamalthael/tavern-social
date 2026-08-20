'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ChatMessage } from '../model/types';
import type { MessageResponse } from './map-thread';

export async function sendMessage(threadId: string, text: string): Promise<ChatMessage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const message = await backendFetch<MessageResponse>(`/threads/${threadId}/messages`, {
    method: 'POST',
    token,
    body: { text },
  });
  // Сообщение только что отправлено текущим пользователем — оно точно «моё».
  return { id: message.id, mine: true, text: message.text, createdAt: message.createdAt };
}
