'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function reinstateAdminCreator(creatorProfileId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  await backendFetch<void>(`/admin/creators/${creatorProfileId}/reinstate`, {
    method: 'POST',
    token,
  });
}
