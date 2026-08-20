'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function markThreadRead(threadId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await backendFetch(`/threads/${threadId}/read`, { method: 'POST', token });
}
