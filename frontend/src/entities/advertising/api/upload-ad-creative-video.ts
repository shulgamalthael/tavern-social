'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Зеркало `uploadAdCreativeImage` — свой эндпоинт (`POST .../advertising/
 * creatives/videos`, backend `createVideoMulterOptions`), только для
 * `format: 'video'` креативов. Тот же приём: возвращает только URL,
 * привязка к креативу — отдельным `POST .../creatives` (`AddAdCreativeInput.
 * videoUrl`). */
export async function uploadAdCreativeVideo(
  businessId: string,
  file: Blob,
): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'creative.mp4');

  return backendUpload<{ url: string }>(`/businesses/${businessId}/advertising/creatives/videos`, {
    token,
    formData,
  });
}
