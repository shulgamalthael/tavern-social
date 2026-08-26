'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Appointment, AppointmentStatus } from '../model/types';

export async function updateAppointmentStatus(
  businessId: string,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Appointment>(`/businesses/${businessId}/appointments/${appointmentId}`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}
