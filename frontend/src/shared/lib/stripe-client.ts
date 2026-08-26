'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * `loadStripe()` подгружает `stripe.js` с CDN Stripe и не должен вызываться
 * повторно на каждый рендер/открытие корзины — модульный кэш здесь тот же
 * приём, что official Stripe examples рекомендуют для React (единственная
 * загрузка скрипта на всё приложение). `null`, если `NEXT_PUBLIC_STRIPE_
 * PUBLISHABLE_KEY` не задан — вызывающий код (`CartWidget`) в этом случае
 * просто не показывает форму оплаты (тот же graceful-путь, что и на
 * backend, см. `PaymentProvider.isConfigured`).
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);
  }
  return stripePromise;
}
