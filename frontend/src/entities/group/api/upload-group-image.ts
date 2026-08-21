'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Group } from '../model/types';
import { mapGroup, type GroupResponse } from './map-group';

/** Аватар/обложка группы — тот же multipart-контракт, что и
 * `uploadProfileImage`, владелец-only на backend. */
export async function uploadGroupImage(
  groupId: string,
  kind: 'avatar' | 'cover',
  file: Blob,
): Promise<Group> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, `${kind}.jpg`);

  const group = await backendUpload<GroupResponse>(`/groups/${groupId}/${kind}`, {
    token,
    formData,
  });
  return mapGroup(group);
}
