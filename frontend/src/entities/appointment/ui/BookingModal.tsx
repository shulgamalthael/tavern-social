'use client';

import { useState, type FormEvent } from 'react';
import type { PublicService } from '@/entities/service';
import { formatDuration } from '@/entities/service';
import { formatMoney } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { CalendarIcon } from '@/shared/ui/icons';
import { createAppointment } from '../api/create-appointment';
import styles from './BookingModal.module.scss';

export interface BookingModalProps {
  businessId: string;
  service: PublicService;
  onClose: () => void;
}

/**
 * Форма записи на конкретную услугу — открывается по клику «Записаться» на
 * карточке услуги (см. `ServiceGridRenderer` в `blocks/booking`). В отличие
 * от `CartWidget` (Commerce), здесь нет понятия корзины — одна запись это
 * всегда одна услуга, поэтому форма открывается сразу, без промежуточного
 * шага «список выбранного». Без выбора из посчитанных свободных слотов (нет
 * движка доступности в этом инкременте, см. комментарий модели `Appointment`
 * в backend schema.prisma) — обычные `<input type="date">`/`<input
 * type="time">`, клиент указывает желаемое время, владелец подтверждает или
 * предлагает другое вручную.
 *
 * Те же токены `--tavern-*` (не `--site-*` темы сайта) и по той же причине,
 * что и `CartWidget.module.scss` — `Modal` рендерится через портал в
 * `document.body`, вне DOM-поддерева, куда `WebsiteRenderer` кладёт
 * `--site-*` переменные темы инлайн-стилем.
 */
export function BookingModal({ businessId, service, onClose }: BookingModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!date || !time) {
      setError('Укажите дату и время');
      return;
    }
    if (!customerName.trim()) {
      setError('Введите имя');
      return;
    }
    const startsAt = new Date(`${date}T${time}`);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setError('Выберите время в будущем');
      return;
    }

    setSubmitting(true);
    setError(null);
    // `createAppointment` никогда не бросает исключение — см. её комментарий
    // в `entities/appointment/api/create-appointment.ts` (`throw` из Server
    // Action стирает реальный текст ошибки в production-сборке Next.js).
    const outcome = await createAppointment(businessId, {
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
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
    setSuccess(true);
  }

  if (isSuccess) {
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
            onChange={(event) => setDate(event.target.value)}
          />
          <input
            type="time"
            className={styles.input}
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>

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
