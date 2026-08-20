'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { EditableProfile } from '../model/types';

interface MeProfileImageResponse {
  avatarUrl: string | null;
  coverUrl: string | null;
}

/** Загружает уже обрезанное на клиенте изображение (см.
 * `features/upload-image`) как аватар или обложку профиля. */
export async function uploadProfileImage(
  kind: 'avatar' | 'cover',
  file: Blob,
): Promise<Pick<EditableProfile, 'avatarUrl' | 'coverUrl'>> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, `${kind}.jpg`);

  const profile = await backendUpload<MeProfileImageResponse>(`/users/me/${kind}`, {
    token,
    formData,
  });
  return { avatarUrl: profile.avatarUrl, coverUrl: profile.coverUrl };
}
