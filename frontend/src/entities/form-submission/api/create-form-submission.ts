'use server';

import { backendFetch } from '@/shared/lib/backend-client';

export interface CreateFormSubmissionInput {
  formType: string;
  formLabel: string;
  data: Record<string, string>;
  /** Honeypot — см. `FormBlock.tsx`/backend `CreateFormSubmissionDto`. */
  honeypot?: string;
}

/** По-настоящему анонимно — отправка формы с витрины не требует сессии
 * Таверны (см. `PublicSitesController.createFormSubmission`), тот же
 * принцип, что и у `createOrder`/`createAppointment`. Backend отвечает
 * `204` без тела — форме нечего показывать в ответе, кроме факта успеха. */
export async function createFormSubmission(
  businessId: string,
  input: CreateFormSubmissionInput,
): Promise<void> {
  await backendFetch<void>(`/sites/${businessId}/form-submissions`, {
    method: 'POST',
    body: input,
  });
}
