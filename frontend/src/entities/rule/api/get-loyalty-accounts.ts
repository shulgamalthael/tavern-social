'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { CustomerLoyaltyAccount } from '../model/types';

/** Владелец-only — накопленные баллы/тиры покупателей (`add_loyalty_points`/
 * `set_membership_tier`, см. `RuleAction`'s комментарий). */
export async function getLoyaltyAccounts(businessId: string): Promise<CustomerLoyaltyAccount[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<CustomerLoyaltyAccount[]>(
    `/businesses/${businessId}/rules/loyalty-accounts`,
    {
      token,
    },
  );
}
