'use server';

import { backendFetch, BackendError } from '@/shared/lib/backend-client';
import type { PublicBlogPost } from '../model/types';

/** `null` — поста с таким slug нет ИЛИ он не опубликован (backend отдаёт оба
 * случая как 404, см. `BlogPostsService.getPublicBySlug`) — вызывающая
 * страница (`/site/[businessId]/blog/[postSlug]`) сама решает, как показать
 * «не найдено», тот же приём, что и у `resolveSitePage` для обычных страниц
 * сайта. Любая ДРУГАЯ ошибка (сеть, 500) пробрасывается дальше — это не
 * «поста нет», а реальный сбой, который должен дойти до `ErrorState`. */
export async function getPublicBlogPostBySlug(
  businessId: string,
  slug: string,
): Promise<PublicBlogPost | null> {
  try {
    return await backendFetch<PublicBlogPost>(`/sites/${businessId}/blog-posts/${slug}`);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
