'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { GalleryImage } from '../model/types';
import { mapGalleryImage, type GalleryImageResponse } from './map-gallery-image';

interface GalleryPageResponse {
  items: GalleryImageResponse[];
  nextCursor: string | null;
}

export async function getGallery(
  userId: string,
  cursor?: string | null,
): Promise<{ images: GalleryImage[]; nextCursor: string | null }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { items, nextCursor } = await backendFetch<GalleryPageResponse>(
    `/users/${userId}/gallery${query}`,
    { token },
  );
  return { images: items.map(mapGalleryImage), nextCursor };
}
