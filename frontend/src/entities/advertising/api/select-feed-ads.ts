'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { SelectedAd } from '../model/types';

/**
 * Авторизованная выдача баннеров в сайдбары ленты Таверны (`widgets/feed`,
 * см. backend `FeedAdsController.select`/`AdEngineService.
 * selectCreativesForFeed`) — в отличие от `getSelectedAd` (анонимный запрос
 * для сайтов бизнесов-паблишеров), здесь зритель — залогиненный пользователь
 * самой Таверны, поэтому нужен токен сессии, а не публичный доступ. Один
 * вызов сразу отдаёт креативы под ВСЕ слоты страницы (по ставке, лучшие —
 * первые), не по одному запросу на слот.
 */
export async function selectFeedAds(count: number): Promise<SelectedAd[]> {
  const token = await getSessionToken();
  if (!token) return [];
  return backendFetch<SelectedAd[]>(`/feed-ads/select?count=${count}`, { token });
}
