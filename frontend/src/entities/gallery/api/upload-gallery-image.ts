'use server';

// entities/post/index.ts тоже реэкспортирует PostCard (клиентский компонент
// с useState) — импорт через барель затянул бы его в граф этого
// server-действия и сломал бы сборку («useState в Server Component»), тот же
// случай, что и с session.server.ts (см. app/page.tsx). Импортируем
// mapPost/тип Post напрямую по пути, в обход барели.
// eslint-disable-next-line no-restricted-imports
import { mapPost, type PostResponse } from '@/entities/post/api/map-post';
// eslint-disable-next-line no-restricted-imports
import type { Post } from '@/entities/post/model/types';
import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { GalleryImage } from '../model/types';
import { mapGalleryImage, type GalleryImageResponse } from './map-gallery-image';

interface GalleryUploadResponse {
  image: GalleryImageResponse;
  post: PostResponse;
}

/** Загружает изображение в галерею — backend одновременно публикует его как
 * запись на стене/в ленте (см. GalleryService.add на backend) и отдаёт эту
 * запись целиком, чтобы вызывающий (`GalleryGrid`) мог сразу дописать её в
 * ленту через `usePostStore.receiveNewPost` — без этого фото появилось бы в
 * ленте только после следующей полной перезагрузки. */
export async function uploadGalleryImage(file: Blob): Promise<{ image: GalleryImage; post: Post }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'gallery.jpg');

  const result = await backendUpload<GalleryUploadResponse>('/users/me/gallery', {
    token,
    formData,
  });
  return { image: mapGalleryImage(result.image), post: mapPost(result.post) };
}
