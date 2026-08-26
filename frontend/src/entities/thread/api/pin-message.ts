'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Thread } from '../model/types';
import { mapThread, type ThreadResponse } from './map-thread';

interface MeIdResponse {
  id: string;
}

async function setPinned(threadId: string, messageId: string, pinned: boolean): Promise<Thread> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const [me, thread] = await Promise.all([
    backendFetch<MeIdResponse>('/users/me', { token }),
    backendFetch<ThreadResponse>(
      `/threads/${threadId}/messages/${messageId}/${pinned ? 'pin' : 'unpin'}`,
      { method: 'PATCH', token },
    ),
  ]);

  return mapThread(thread, me.id);
}

export async function pinMessage(threadId: string, messageId: string): Promise<Thread> {
  return setPinned(threadId, messageId, true);
}

export async function unpinMessage(threadId: string, messageId: string): Promise<Thread> {
  return setPinned(threadId, messageId, false);
}
