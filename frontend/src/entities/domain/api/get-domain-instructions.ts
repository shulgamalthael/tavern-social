'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { DnsInstruction } from '../model/types';

/** Пересчитывает те же инструкции, что `connectDomain` уже вернул при
 * подключении (см. `DomainsService.getInstructions`) — на случай, если
 * пользователь закрыл модалку с ними и вернулся позже, пока домен всё ещё
 * не подтверждён. */
export async function getDomainInstructions(
  businessId: string,
  domainId: string,
): Promise<DnsInstruction[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<DnsInstruction[]>(
    `/businesses/${businessId}/domains/${domainId}/instructions`,
    { token },
  );
}
