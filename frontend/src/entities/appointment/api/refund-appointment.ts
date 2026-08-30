'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Appointment } from '../model/types';

/** Возврат целиком, владелец-only — см. `AppointmentsService.refund` на
 * backend, зеркало `entities/order`'s `refundOrder` (тот же простой
 * throw-based контракт: owner-facing действие в Dashboard, не анонимный
 * клиентский путь). */
export async function refundAppointment(
  businessId: string,
  appointmentId: string,
): Promise<Appointment> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Appointment>(
    `/businesses/${businessId}/appointments/${appointmentId}/refund`,
    {
      method: 'POST',
      token,
    },
  );
}
