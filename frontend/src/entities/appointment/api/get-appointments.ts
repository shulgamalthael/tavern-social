'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Appointment } from '../model/types';

export async function getAppointments(businessId: string): Promise<Appointment[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Appointment[]>(`/businesses/${businessId}/appointments`, { token });
}
