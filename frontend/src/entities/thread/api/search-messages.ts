'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ChatMessage } from '../model/types';
import { mapMessage, type MessageResponse } from './map-thread';

interface MeIdResponse {
  id: string;
}

/** Поиск по тексту сообщений внутри одного треда — только его участнику
 * (backend проверяет). */
export async function searchThreadMessages(threadId: string, q: string): Promise<ChatMessage[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const [me, messages] = await Promise.all([
    backendFetch<MeIdResponse>('/users/me', { token }),
    backendFetch<MessageResponse[]>(
      `/threads/${threadId}/messages/search?q=${encodeURIComponent(q)}`,
      { token },
    ),
  ]);

  return messages.map((message) => mapMessage(message, me.id));
}

export interface ThreadSearchResult {
  threadId: string;
  messages: ChatMessage[];
}

interface ThreadSearchResultResponse {
  threadId: string;
  messages: MessageResponse[];
}

/** Поиск по тексту сообщений сразу по всем тредам текущего пользователя —
 * имена/аватары тредов сюда не подтягиваются, frontend сопоставляет
 * `threadId` с уже загруженным списком в `useThreadStore` (см. `entities/
 * thread/model/thread-store.ts`). */
export async function searchAllThreads(q: string): Promise<ThreadSearchResult[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const [me, results] = await Promise.all([
    backendFetch<MeIdResponse>('/users/me', { token }),
    backendFetch<ThreadSearchResultResponse[]>(`/threads/search?q=${encodeURIComponent(q)}`, {
      token,
    }),
  ]);

  return results.map((result) => ({
    threadId: result.threadId,
    messages: result.messages.map((message) => mapMessage(message, me.id)),
  }));
}
