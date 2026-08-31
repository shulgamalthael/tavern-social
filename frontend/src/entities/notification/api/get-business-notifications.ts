'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { BusinessNotification } from '../model/types';

/** Владелец-only — уведомления Business Logic Engine (`rule_triggered`,
 * AI_PLATFORM_ROADMAP.md §15.4) для одного бизнеса, тот же принцип, что
 * `getRules`. Не пересекается с общей социальной лентой (`getNotifications`)
 * — backend исключает `rule_triggered` из неё (см. `FEED_EXCLUDED_TYPES`),
 * это единственный read-путь, который вообще отдаёт такие строки. */
export async function getBusinessNotifications(
  businessId: string,
): Promise<BusinessNotification[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<BusinessNotification[]>(`/businesses/${businessId}/notifications`, {
    token,
  });
}
