'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export async function uploadProductImage(businessId: string, file: Blob): Promise<{ url: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'product.jpg');

  return backendUpload<{ url: string }>(`/businesses/${businessId}/products/images`, {
    token,
    formData,
  });
}
