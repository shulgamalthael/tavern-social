'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState, type FormEvent } from 'react';
import { getStripe } from '@/shared/lib/stripe-client';
import { Button } from '@/shared/ui/Button';
import styles from './StripePaymentForm.module.scss';

interface InnerFormProps {
  onPaid: () => void;
  submitLabel: string;
}

/** Живёт ВНУТРИ `<Elements>` (см. `StripePaymentForm` ниже) — `useStripe`/
 * `useElements` работают только там. `redirect: 'if_required'` —
 * большинство способов оплаты (карта) подтверждаются без ухода со
 * страницы; Stripe уводит на `return_url` только если конкретный выбранный
 * способ реально этого требует (некоторые локальные методы оплаты), а не
 * всегда. */
function InnerForm({ onPaid, submitLabel }: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Не удалось провести оплату');
      setSubmitting(false);
      return;
    }
    onPaid();
  }

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
      <PaymentElement />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={!stripe || isSubmitting}>
        {isSubmitting ? 'Оплачиваем…' : submitLabel}
      </Button>
    </form>
  );
}

export interface StripePaymentFormProps {
  /** `PaymentIntent.client_secret` — из ответа backend'а (`OrderDto.
   * clientSecret`/`AdCampaignDto.clientSecret`, любой другой вызывающий
   * той же формы). */
  clientSecret: string;
  onPaid: () => void;
  submitLabel?: string;
}

/**
 * Общая обёртка `<Elements>` + форма Stripe Payment Element — вынесена из
 * `CartWidget` (была локальным `PaymentForm` только для оформления заказа)
 * второй раз, когда та же самая нужда возникла у self-service рекламных
 * кампаний (`AdvertisingSection`, `AI_PLATFORM_ROADMAP.md` §68) — тот же
 * `PaymentProvider`/`clientSecret` контракт на backend для обоих. Не
 * копия, единственное место, которое реально говорит со Stripe Elements
 * на фронтенде.
 */
export function StripePaymentForm({
  clientSecret,
  onPaid,
  submitLabel = 'Оплатить',
}: StripePaymentFormProps) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <InnerForm onPaid={onPaid} submitLabel={submitLabel} />
    </Elements>
  );
}
