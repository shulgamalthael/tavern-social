'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Thread } from '../model/types';
import { mapThread, type ThreadResponse } from './map-thread';

interface MeIdResponse {
  id: string;
}

/** Список диалогов нужен и Header (счётчик непрочитанных), и мессенджеру. */
export async function getThreads(): Promise<Thread[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const [me, threads] = await Promise.all([
    backendFetch<MeIdResponse>('/users/me', { token }),
    backendFetch<ThreadResponse[]>('/threads', { token }),
  ]);

  return threads.map((thread) => mapThread(thread, me.id));
}
