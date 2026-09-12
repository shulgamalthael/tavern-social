'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { AdPlacement } from '../model/types';

interface RecordAdEventInput {
  campaignId: string;
  creativeId: string;
  /** Место, где реально произошёл этот показ/клик — нужно backend'у только
   * для пересчёта цены погашения второй-цена-аукциона (см. backend
   * `AdCampaignsService.refreshClearingPrice`'s комментарий), сам учёт
   * показа/клика от него не зависит. */
  placement: AdPlacement;
}

/** Fire-and-forget — вызывается `AdSlotRenderer` ПОСЛЕ того, как креатив
 * реально смонтировался (impression) или по нему кликнули (click), тот же
 * принцип разделения, что у backend `AnalyticsService.record` (не должен
 * ронять рендер страницы посетителю). Вызывающий код НЕ обязан ждать/
 * обрабатывать ошибку — обе функции просто резолвятся, ошибка сети здесь
 * не более значима, чем непоказанный счётчик статистики. */
export async function recordAdImpression(
  businessId: string,
  input: RecordAdEventInput,
): Promise<void> {
  await backendFetch<void>(`/sites/${businessId}/ads/impression`, { method: 'POST', body: input });
}

export async function recordAdClick(businessId: string, input: RecordAdEventInput): Promise<void> {
  await backendFetch<void>(`/sites/${businessId}/ads/click`, { method: 'POST', body: input });
}
