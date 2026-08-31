'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { WalletInfo } from '../model/types';

/**
 * По-настоящему анонимный запрос (см. `PublicSitesController.
 * getPublicWalletInfo`, тот же принцип, что `getPublicProducts`) — для
 * блока `web3wallet` (`entities/website/blocks/web3`), вызывается и на
 * канвасе/Preview билдера, и на реальной публичной странице сайта (тот же
 * "Preview = тот же рендерер и те же данные", что уже применён к
 * `productgrid`/`servicegrid`).
 */
export async function getPublicWalletInfo(businessId: string): Promise<WalletInfo> {
  return backendFetch<WalletInfo>(`/sites/${businessId}/web3/wallet`);
}
