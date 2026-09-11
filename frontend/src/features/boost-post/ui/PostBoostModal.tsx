'use client';

import { useState, type FormEvent } from 'react';
import { createPostBoost, type Post } from '@/entities/post';
import {
  CURRENCY_OPTIONS,
  DEFAULT_BUSINESS_CURRENCY,
  getCurrencyMetadata,
} from '@/shared/config/currencies';
import { toMinorUnits } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { StripePaymentForm } from '@/shared/ui/StripePaymentForm';
import styles from './PostBoostModal.module.scss';

export interface PostBoostModalProps {
  post: Post;
  onClose: () => void;
  /** Вызывается после подтверждённой оплаты — виджет-вызывающий сам решает,
   * как обновить список (см. `entities/post` не может импортировать
   * `features/*`, обратной связи через store здесь не нужно). */
  onBoosted: () => void;
}

const DURATION_OPTIONS = [1, 3, 5, 7] as const;

/**
 * Instagram-style продвижение поста (AI_PLATFORM_ROADMAP.md §73) —
 * отдельный feature-слайс, не часть `publish-post`: это не редактирование
 * контента, а платное действие с собственным Stripe-шагом, ближе по форме к
 * `AdvertisingSection`'s кампаниям, чем к `PostEditor`. Два шага в одной
 * модалке: форма (бюджет/валюта/срок) → после `createPostBoost` тот же
 * общий `StripePaymentForm`, что уже использует `CartWidget`/
 * `AdvertisingSection` — ни одной новой строчки интеграции со Stripe.
 */
export function PostBoostModal({ post, onClose, onBoosted }: PostBoostModalProps) {
  const [currency, setCurrency] = useState(DEFAULT_BUSINESS_CURRENCY);
  const [budget, setBudget] = useState('');
  const [durationDays, setDurationDays] = useState<(typeof DURATION_OPTIONS)[number]>(3);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencyMetadata = getCurrencyMetadata(currency);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const budgetCents = toMinorUnits(budget, currency);
    if (budgetCents === null || budgetCents < 100) {
      setError('Введите бюджет, минимум $1 (эквивалент в вашей валюте)');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { clientSecret: secret } = await createPostBoost(post.id, {
        budgetCents,
        currency,
        durationDays,
      });
      setClientSecret(secret);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось начать продвижение',
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Продвижение записи" className={styles.modal}>
      <h2 className={styles.title}>Продвижение записи</h2>
      <p className={styles.hint}>
        Оплаченная запись показывается в ленте не только друзьям и участникам ваших сообществ, но и
        всем остальным — с пометкой «Продвигается».
      </p>

      {!clientSecret ? (
        <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>
                Бюджет, {currencyMetadata.symbol} ({currencyMetadata.code})
              </span>
              <input
                type="text"
                inputMode="decimal"
                className={styles.input}
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="10"
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Валюта</span>
              <select
                className={styles.input}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Срок продвижения</span>
            <select
              className={styles.input}
              value={durationDays}
              onChange={(event) =>
                setDurationDays(Number(event.target.value) as (typeof DURATION_OPTIONS)[number])
              }
            >
              {DURATION_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} {days === 1 ? 'день' : 'дней'}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Готовим оплату…' : 'Продолжить к оплате'}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <StripePaymentForm
            clientSecret={clientSecret}
            submitLabel="Оплатить продвижение"
            onPaid={onBoosted}
          />
          <p className={styles.hint}>
            Продвижение появится в ленте в течение нескольких минут после подтверждения оплаты.
          </p>
        </>
      )}
    </Modal>
  );
}
