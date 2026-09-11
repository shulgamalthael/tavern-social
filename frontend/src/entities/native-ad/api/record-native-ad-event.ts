'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

/** Fire-and-forget — тот же принцип, что `recordAdImpression`/`recordAdClick`
 * (`entities/advertising`): вызывающий код не обязан ждать/обрабатывать
 * ошибку. Авторизованный (не анонимный, как сайтовая реклама) — реклама в
 * ленте видна только залогиненному зрителю. Принимает `assignmentId`, не
 * `campaignId` (Creator Monetization Phase 4, AI_PLATFORM_ROADMAP.md §82) —
 * backend приписывает событие конкретному назначению/creator'у в ledger
 * (`NativeAdRevenueEvent`), без `assignmentId` это было бы невозможно. */
export async function recordNativeAdImpression(assignmentId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await backendFetch<void>('/native-ads/feed/impression', {
    method: 'POST',
    token,
    body: { assignmentId },
  });
}

export async function recordNativeAdClick(assignmentId: string): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await backendFetch<void>('/native-ads/feed/click', {
    method: 'POST',
    token,
    body: { assignmentId },
  });
}
