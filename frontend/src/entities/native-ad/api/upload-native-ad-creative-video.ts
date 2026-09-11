'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function uploadNativeAdCreativeVideo(
  businessId: string,
  file: Blob,
): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'creative.mp4');

  return backendUpload<{ url: string }>(
    `/businesses/${businessId}/native-ad-campaigns/creatives/videos`,
    { token, formData },
  );
}
