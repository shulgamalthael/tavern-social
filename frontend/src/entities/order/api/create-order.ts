'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { Order, PaymentUnavailableReason } from '../model/types';

/** См. подробный комментарий у `createOrder` ниже — обычный `throw` из
 * Server Action в production-сборке Next.js заменяет реальное сообщение
 * ошибки на нечитаемый "Minified React error #NNN" (задокументированное
 * поведение Next.js — https://nextjs.org/docs/app/getting-started/error-handling,
 * "For these errors, avoid using try/catch blocks and throw errors. Instead,
 * model expected errors as return values"). Реальный баг этого проекта,
 * пойманный вживую при попытке реального покупателя оформить заказ с
 * невалидным номером телефона: вместо "Некорректный номер телефона"
 * покупатель увидел ровно этот нечитаемый digest. */
export type CreateOrderOutcome =
  { ok: true; order: CreateOrderResult } | { ok: false; error: string };

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerNote?: string;
  /** Промокод, если покупатель ввёл (см. `CouponField` в `CartWidget`) —
   * пересчитывается заново на backend, этот вызов не подставляет заранее
   * посчитанную скидку. */
  couponCode?: string;
  items: CreateOrderItemInput[];
}

/** Присутствует в ответе, только если у бизнеса настроен Stripe (см.
 * `OrdersService.createFromCart`) — `CartWidget` передаёт его в Stripe
 * Elements (`<Elements options={{ clientSecret }}>`), чтобы собрать форму
 * оплаты именно для этого заказа. Если `clientSecret` отсутствует,
 * `paymentUnavailableReason` объясняет почему (см. `PaymentUnavailable
 * Reason`) — заказ всё равно создаётся (честная заявка без оплаты) в
 * любом случае, оба поля только про то, показывать ли шаг оплаты. */
export type CreateOrderResult = Order & {
  clientSecret?: string;
  paymentUnavailableReason?: PaymentUnavailableReason;
};

/** По-настоящему анонимно — оформление заказа с витрины не требует сессии
 * Таверны (см. `PublicSitesController.createOrder`), тот же принцип, что и
 * у `getAnonymousPublicSite`/`getPublicProducts`. Цена и название каждой
 * позиции пересчитываются на backend из актуального товара — этот вызов
 * посылает только `productId`/`quantity`, никогда цену.
 *
 * НИКОГДА не бросает исключение наружу (ошибка backend'а — невалидный
 * телефон/email, распроданный товар, невалидный промокод — ловится ВНУТРИ и
 * возвращается как `{ ok: false, error }`, см. `CreateOrderOutcome` выше) —
 * анонимный покупатель на реальном опубликованном сайте видит production-
 * сборку Next.js, где `throw` из Server Action стирает реальный текст
 * ошибки. `CartWidget.onSubmit` проверяет `outcome.ok`, а не оборачивает
 * вызов в `try/catch`. */
export async function createOrder(
  businessId: string,
  input: CreateOrderInput,
): Promise<CreateOrderOutcome> {
  try {
    const order = await backendFetch<CreateOrderResult>(`/sites/${businessId}/orders`, {
      method: 'POST',
      body: input,
    });
    return { ok: true, order };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось отправить заказ',
    };
  }
}
