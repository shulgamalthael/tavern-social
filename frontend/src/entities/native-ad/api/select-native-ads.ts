'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { NativeAdFeedItem } from '../model/types';

/**
 * В отличие от `getSelectedAd` (сайтовая реклама, анонимный запрос) — это
 * авторизованный запрос за уже загруженную клиентом страницу ленты (см.
 * backend `NativeAdFeedController.select`'s комментарий): движок сам решает,
 * у каких из присланных `postIds` есть основание показать рекламу, здесь
 * просто передаём их. Возвращает разреженную карту — не все посты получат
 * запись.
 */
export async function selectNativeAds(
  postIds: string[],
): Promise<Record<string, NativeAdFeedItem>> {
  if (postIds.length === 0) return {};
  const token = await getSessionToken();
  if (!token) return {};

  return backendFetch<Record<string, NativeAdFeedItem>>('/native-ads/feed/select', {
    method: 'POST',
    token,
    body: { postIds },
  });
}
