'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Thread } from '../model/types';
import { mapThread, type ThreadResponse } from './map-thread';

interface MeIdResponse {
  id: string;
}

export async function getOrCreateDirectThread(otherUserId: string): Promise<Thread> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const [me, thread] = await Promise.all([
    backendFetch<MeIdResponse>('/users/me', { token }),
    backendFetch<ThreadResponse>(`/threads/direct/${otherUserId}`, { method: 'POST', token }),
  ]);

  return mapThread(thread, me.id);
}
