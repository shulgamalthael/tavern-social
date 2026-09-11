'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { AdPlacement, SelectedAd } from '../model/types';

/**
 * По-настоящему анонимный запрос (см. `PublicSitesController.selectAd`,
 * тот же контроллер и тот же принцип, что и `getPublicProducts`) —
 * вызывается напрямую из клиентского `AdSlotRenderer`
 * (`entities/website/blocks/advertising`). `null` — честный "нет подходящей
 * кампании сейчас", не ошибка. Backend оборачивает ответ в `{ creative }`
 * (не голый `null`) намеренно — см. её комментарий про то, почему это
 * единственный способ гарантировать валидный JSON-текст в теле ответа.
 */
export async function getSelectedAd(
  businessId: string,
  placement: AdPlacement,
  device: 'desktop' | 'tablet' | 'mobile',
): Promise<SelectedAd | null> {
  const params = new URLSearchParams({ placement, device });
  const { creative } = await backendFetch<{ creative: SelectedAd | null }>(
    `/sites/${businessId}/ads/select?${params.toString()}`,
  );
  return creative;
}
