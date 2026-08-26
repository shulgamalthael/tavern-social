'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Картинка для содержимого блока (фон Hero, галерея, фото команды…) — не
 * привязана к конкретному полю на backend, только к бизнесу-владельцу (см.
 * `WebsitesController.uploadAsset`); куда именно вставить полученный URL,
 * решает сам builder (`widgets/website-builder/ui/inspector/ImageField.tsx`). */
export async function uploadWebsiteAsset(businessId: string, file: Blob): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'asset.jpg');

  return backendUpload<{ url: string }>(`/businesses/${businessId}/website/assets`, {
    token,
    formData,
  });
}
