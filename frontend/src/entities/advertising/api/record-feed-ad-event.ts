'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

interface RecordFeedAdEventInput {
  campaignId: string;
  creativeId: string;
}

/** Fire-and-forget — тот же принцип, что `recordAdImpression`/`recordAdClick`
 * (сайтовая реклама), но с токеном сессии вместо анонимного вызова, см.
 * `selectFeedAds`'s комментарий про разницу. */
export async function recordFeedAdImpression(input: RecordFeedAdEventInput): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await backendFetch<void>('/feed-ads/impression', { method: 'POST', token, body: input });
}

export async function recordFeedAdClick(input: RecordFeedAdEventInput): Promise<void> {
  const token = await getSessionToken();
  if (!token) return;
  await backendFetch<void>('/feed-ads/click', { method: 'POST', token, body: input });
}
