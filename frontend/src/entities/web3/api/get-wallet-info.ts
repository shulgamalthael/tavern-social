'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { WalletInfo } from '../model/types';

/** Владелец-only — баланс/NFT кошелька, указанного для бизнеса (тот же
 * принцип, что у `getRules`/`getLoyaltyAccounts`). */
export async function getWalletInfo(businessId: string): Promise<WalletInfo> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<WalletInfo>(`/businesses/${businessId}/web3/wallet`, { token });
}
