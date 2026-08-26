'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { Appointment } from '../model/types';

export interface CreateAppointmentInput {
  serviceId: string;
  /** ISO-строка желаемого времени начала. */
  startsAt: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNote?: string;
}

/** Ошибка backend'а (невалидный телефон/email, недоступная услуга, время в
 * прошлом) возвращается как `{ ok: false, error }`, а не бросается как
 * исключение — тот же принцип и та же причина, что у `createOrder` в
 * `entities/order` (см. её комментарий): `throw` из Server Action в
 * production-сборке Next.js стирает реальный текст ошибки в нечитаемый
 * "Minified React error #NNN", реальный баг, пойманный вживую. */
export type CreateAppointmentOutcome =
  { ok: true; appointment: Appointment } | { ok: false; error: string };

/** По-настоящему анонимно — заявка на запись с витрины не требует сессии
 * Таверны (см. `PublicSitesController.createAppointment`), тот же принцип,
 * что и у `createOrder` в `entities/order`. */
export async function createAppointment(
  businessId: string,
  input: CreateAppointmentInput,
): Promise<CreateAppointmentOutcome> {
  try {
    const appointment = await backendFetch<Appointment>(`/sites/${businessId}/appointments`, {
      method: 'POST',
      body: input,
    });
    return { ok: true, appointment };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось отправить заявку',
    };
  }
}
