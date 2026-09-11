'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';

export interface CreatePostBoostInput {
  budgetCents: number;
  currency: string;
  durationDays: number;
}

/** Создаёт `PaymentIntent` на бюджет продвижения (AI_PLATFORM_ROADMAP.md
 * §73) — активация происходит только по вебхуку Stripe, см. backend
 * `PostBoostsService.markPaidByPaymentIntent`, не по этому ответу.
 * `clientSecret` передаётся в тот же общий `StripePaymentForm`, что уже
 * используют `CartWidget`/`AdvertisingSection`. */
export async function createPostBoost(
  postId: string,
  input: CreatePostBoostInput,
): Promise<{ clientSecret: string }> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<{ clientSecret: string }>(`/posts/${postId}/boost`, {
    method: 'POST',
    token,
    body: input,
  });
}
