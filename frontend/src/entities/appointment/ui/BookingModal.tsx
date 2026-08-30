'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useCallback, useState, type FormEvent } from 'react';
import type { PublicService } from '@/entities/service';
import { formatDuration } from '@/entities/service';
import { formatMoney } from '@/shared/lib/format-money';
import { getStripe } from '@/shared/lib/stripe-client';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { CalendarIcon } from '@/shared/ui/icons';
import { createAppointment } from '../api/create-appointment';
import { getAvailability } from '../api/get-availability';
import { PAYMENT_UNAVAILABLE_REASON_LABELS, type PaymentUnavailableReason } from '../model/types';
import styles from './BookingModal.module.scss';

export interface BookingModalProps {
  businessId: string;
  service: PublicService;
  onClose: () => void;
}

type Step = 'form' | 'payment' | 'payment-unavailable' | 'success';

interface PaymentFormProps {
  onPaid: () => void;
}

/** Живёт ВНУТРИ `<Elements>` — зеркало `CartWidget`'s `PaymentForm`, тот же
 * компонент один в один (`useStripe`/`useElements` работают только внутри
 * `<Elements>`), не переиспользован напрямую из `entities/cart` только
 * потому, что Booking не должен зависеть от слайса Commerce ради одной
 * формы. */
function PaymentForm({ onPaid }: PaymentFormProps) {
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
        {isSubmitting ? 'Оплачиваем…' : 'Оплатить'}
      </Button>
    </form>
  );
}

/**
 * Форма записи на конкретную услугу — открывается по клику «Записаться» на
 * карточке услуги (см. `ServiceGridRenderer` в `blocks/booking`). В отличие
 * от `CartWidget` (Commerce), здесь нет понятия корзины — одна запись это
 * всегда одна услуга, поэтому форма открывается сразу, без промежуточного
 * шага «список выбранного».
 *
 * Дата выбирается `<input type="date">`, время — списком реально свободных
 * слотов (`GET .../availability`, ROADMAP.md §8 Phase 6 continued), а не
 * произвольным `<input type="time">`: backend всё равно отклонил бы время
 * вне часов работы или занятое другой записью (`AppointmentsService.
 * createFromRequest`), так что предлагать посетителю то, что заведомо будет
 * отклонено, было бы хуже, чем просто не предлагать вовсе. Владелец
 * по-прежнему подтверждает запись вручную — только сам выбор времени больше
 * не может случайно совпасть с уже занятым.
 *
 * Оплата (Booking payment, ROADMAP.md §8 Phase 6 continued) — та же схема,
 * что и `CartWidget`: если у бизнеса настроен Stripe, `createAppointment`
 * вернул `clientSecret` для полной цены услуги (без депозита), показываем
 * `PaymentElement`; если Stripe не настроен или создание `PaymentIntent`
 * упало по конкретной причине, показываем честный `payment-unavailable` с
 * этой причиной вместо молчаливого пропуска шага. В обоих случаях заявка на
 * backend уже создана — оплата отдельный, необязательный для успеха шаг.
 *
 * Те же токены `--tavern-*` (не `--site-*` темы сайта) и по той же причине,
 * что и `CartWidget.module.scss` — `Modal` рендерится через портал в
 * `document.body`, вне DOM-поддерева, куда `WebsiteRenderer` кладёт
 * `--site-*` переменные темы инлайн-стилем.
 */
export function BookingModal({ businessId, service, onClose }: BookingModalProps) {
  const [date, setDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentUnavailableReason, setPaymentUnavailableReason] =
    useState<PaymentUnavailableReason | null>(null);

  // Пустая строка без запроса, а не запрос с мусорной датой — `date` пуст
  // до первого выбора в `<input type="date">`. Меняющийся `date` пересоздаёт
  // `fetcher`, и `useAsyncData` перезапрашивает слоты сам (см. её комментарий
  // про стабильность ссылки).
  const availabilityFetcher = useCallback(
    () => (date ? getAvailability(businessId, service.id, date) : Promise.resolve([])),
    [businessId, service.id, date],
  );
  const availability = useAsyncData(availabilityFetcher);
  const slots = availability.data ?? [];

  function handleDateChange(nextDate: string) {
    setDate(nextDate);
    setSelectedSlot('');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedSlot) {
      setError('Выберите дату и время');
      return;
    }
    if (!customerName.trim()) {
      setError('Введите имя');
      return;
    }

    setSubmitting(true);
    setError(null);
    // `createAppointment` никогда не бросает исключение — см. её комментарий
    // в `entities/appointment/api/create-appointment.ts` (`throw` из Server
    // Action стирает реальный текст ошибки в production-сборке Next.js).
    const outcome = await createAppointment(businessId, {
      serviceId: service.id,
      startsAt: selectedSlot,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      customerNote: customerNote.trim() || undefined,
    });
    setSubmitting(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }

    const appointment = outcome.appointment;
    if (appointment.clientSecret) {
      setClientSecret(appointment.clientSecret);
      setStep('payment');
    } else if (appointment.paymentUnavailableReason) {
      setPaymentUnavailableReason(appointment.paymentUnavailableReason);
      setStep('payment-unavailable');
    } else {
      setStep('success');
    }
  }

  if (step === 'success') {
    return (
      <Modal onClose={onClose} label="Заявка отправлена" className={styles.modal}>
        <div className={styles.success}>
          <CalendarIcon className={styles['success__icon']} />
          <h2 className={styles.title}>Заявка отправлена!</h2>
          <p className={styles.hint}>Исполнитель получил вашу заявку и скоро свяжется с вами.</p>
          <Button onClick={onClose}>Закрыть</Button>
        </div>
      </Modal>
    );
  }

  if (step === 'payment' && clientSecret) {
    return (
      <Modal onClose={onClose} label="Оплата" className={styles.modal}>
        <h2 className={styles.title}>Оплата</h2>
        <div className={styles.total}>
          <span>К оплате</span>
          <span>{formatMoney(service.priceCents, service.currency)}</span>
        </div>
        <Elements stripe={getStripe()} options={{ clientSecret }}>
          <PaymentForm onPaid={() => setStep('success')} />
        </Elements>
      </Modal>
    );
  }

  if (step === 'payment-unavailable' && paymentUnavailableReason) {
    return (
      <Modal onClose={onClose} label="Оплата" className={styles.modal}>
        <h2 className={styles.title}>Оплата</h2>
        <div className={styles.total}>
          <span>Сумма записи</span>
          <span>{formatMoney(service.priceCents, service.currency)}</span>
        </div>
        <div
          className={styles.paymentUnavailable}
          title={PAYMENT_UNAVAILABLE_REASON_LABELS[paymentUnavailableReason]}
        >
          <span className={styles['paymentUnavailable__badge']}>Оплата картой недоступна</span>
          <p className={styles['paymentUnavailable__text']}>
            {PAYMENT_UNAVAILABLE_REASON_LABELS[paymentUnavailableReason]}
          </p>
        </div>
        <Button onClick={() => setStep('success')}>Понятно</Button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} label={`Записаться на «${service.name}»`} className={styles.modal}>
      <h2 className={styles.title}>Записаться</h2>
      <p className={styles.serviceLine}>
        {service.name} · {formatDuration(service.durationMinutes)} ·{' '}
        {formatMoney(service.priceCents, service.currency)}
      </p>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <div className={styles.row}>
          <input
            type="date"
            className={styles.input}
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => handleDateChange(event.target.value)}
          />
          <select
            className={styles.input}
            value={selectedSlot}
            disabled={!date || availability.status !== 'success' || slots.length === 0}
            onChange={(event) => setSelectedSlot(event.target.value)}
          >
            <option value="">
              {!date
                ? 'Сначала дата'
                : availability.status === 'loading'
                  ? 'Загружаем…'
                  : slots.length === 0
                    ? 'Нет свободного времени'
                    : 'Время'}
            </option>
            {slots.map((slot) => (
              <option key={slot} value={slot}>
                {new Date(slot).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </option>
            ))}
          </select>
        </div>

        {availability.status === 'error' && (
          <p className={styles.error} role="alert">
            {availability.error}
          </p>
        )}

        <input
          type="text"
          className={styles.input}
          placeholder="Имя"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
        />
        <input
          type="tel"
          className={styles.input}
          placeholder="Телефон"
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
        />
        <input
          type="email"
          className={styles.input}
          placeholder="Email (необязательно)"
          value={customerEmail}
          onChange={(event) => setCustomerEmail(event.target.value)}
        />
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder="Комментарий (необязательно)"
          value={customerNote}
          onChange={(event) => setCustomerNote(event.target.value)}
        />

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
            {isSubmitting ? 'Отправляем…' : 'Записаться'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
