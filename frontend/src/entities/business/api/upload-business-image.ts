'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Business } from '../model/types';
import { mapBusiness, type BusinessResponse } from './map-business';

/** Лого/favicon бизнеса — тот же multipart-контракт, что и
 * `uploadGroupImage`, владелец-only на backend. */
export async function uploadBusinessImage(
  businessId: string,
  kind: 'logo' | 'favicon',
  file: Blob,
): Promise<Business> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, `${kind}.jpg`);

  const business = await backendUpload<BusinessResponse>(`/businesses/${businessId}/${kind}`, {
    token,
    formData,
  });
  return mapBusiness(business);
}
