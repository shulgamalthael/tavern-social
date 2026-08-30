'use server';

import { backendFetch } from '@/shared/lib/backend-client';

/** По-настоящему анонимно, тот же принцип, что и `createAppointment` — сам
 * список свободных слотов не требует сессии Таверны (см.
 * `PublicSitesController.getAvailability`). `date` — `"ГГГГ-ММ-ДД"`, ровно
 * то, что отдаёт `<input type="date">` (см. `BookingModal.tsx`). Возвращает
 * ISO-строки начала слотов — `[]`, если бизнес закрыт в этот день или все
 * слоты уже заняты/прошли, не ошибка. */
export async function getAvailability(
  businessId: string,
  serviceId: string,
  date: string,
): Promise<string[]> {
  return backendFetch<string[]>(
    `/sites/${businessId}/services/${serviceId}/availability?date=${date}`,
  );
}
