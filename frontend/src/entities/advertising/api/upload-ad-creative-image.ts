'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** См. `uploadProductImage` — тот же приём: только URL, привязка к
 * конкретному креативу происходит отдельным `POST .../creatives` (см.
 * `AddAdCreativeInput.imageUrl`), не этим запросом. */
export async function uploadAdCreativeImage(
  businessId: string,
  file: Blob,
): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'creative.jpg');

  return backendUpload<{ url: string }>(`/businesses/${businessId}/advertising/creatives/images`, {
    token,
    formData,
  });
}
