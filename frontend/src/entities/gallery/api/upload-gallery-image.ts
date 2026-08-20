'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { GalleryImage } from '../model/types';

/** Загружает уже обрезанное на клиенте изображение (см.
 * `features/upload-image`) в свою галерею. */
export async function uploadGalleryImage(file: Blob): Promise<GalleryImage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'gallery.jpg');

  return backendUpload<GalleryImage>('/users/me/gallery', { token, formData });
}
