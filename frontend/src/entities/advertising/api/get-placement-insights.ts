'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { PlacementInsight } from '../model/types';

/** Владелец-only — подсказка для `AdCampaignFormModal` (популярные/свободные
 * места по количеству уже активных кампаний), см. backend
 * `AdCampaignsService.getPlacementInsights`'s комментарий. */
export async function getPlacementInsights(businessId: string): Promise<PlacementInsight[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<PlacementInsight[]>(
    `/businesses/${businessId}/advertising/placement-insights`,
    { token },
  );
}
