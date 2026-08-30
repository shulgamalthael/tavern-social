'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type {
  Business,
  BusinessCapability,
  BusinessCategory,
  SocialLink,
  TaxMode,
  WorkingHours,
} from '../model/types';
import { mapBusiness, type BusinessResponse } from './map-business';

export interface UpdateBusinessInput {
  name?: string;
  slug?: string;
  description?: string;
  category?: BusinessCategory;
  email?: string;
  phone?: string;
  address?: string;
  socialLinks?: SocialLink[];
  seoTitle?: string;
  seoDescription?: string;
  capabilities?: BusinessCapability[];
  /** Смена основной валюты — см. предупреждение о необратимости конверсии
   * цен в `BusinessCurrencySection.tsx` (Currency System, ROADMAP.md §8). */
  currency?: string;
  /** Базисные пункты (2000 = 20.00%) — см. `Business.taxRateBps`. */
  taxRateBps?: number;
  taxMode?: TaxMode;
  /** `null` очищает часы — «не ограничено» (см. `Business.workingHours`'s
   * комментарий в `model/types.ts`). */
  workingHours?: WorkingHours | null;
}

/** Владелец-only на backend (см. `BusinessesService.update`). */
export async function updateBusiness(
  businessId: string,
  input: UpdateBusinessInput,
): Promise<Business> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const business = await backendFetch<BusinessResponse>(`/businesses/${businessId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
  return mapBusiness(business);
}
