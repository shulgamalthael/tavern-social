'use client';

import { useState, type FormEvent } from 'react';
import { createService, updateService, type Service } from '@/entities/service';
import { getCurrencyMetadata } from '@/shared/config/currencies';
import { fromMinorUnits, toMinorUnits } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { ServiceImageField } from './ServiceImageField';
import styles from './ProductFormModal.module.scss';

export interface ServiceFormModalProps {
  businessId: string;
  /** Валюта бизнеса (Currency System, ROADMAP.md §8) — см. комментарий
   * `ProductFormModalProps.currency`, тот же приём. */
  currency: string;
  /** `null` — создание новой услуги, иначе — редактирование существующей. */
  service: Service | null;
  onSaved: () => void;
  onClose: () => void;
}

/** `null` — введено что-то нечисловое или не заполнено вовсе: в отличие от
 * цены товара, длительность услуги ОБЯЗАТЕЛЬНА (нет аналога «остаток не
 * отслеживается» — без длительности запись нельзя даже приблизительно
 * спланировать), поэтому здесь нет третьего состояния «пусто и это ок». */
function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed >= 5 ? parsed : null;
}

/** Зеркало `ProductFormModal.tsx` — переиспользует те же стили
 * (`ProductFormModal.module.scss`) и тот же приём для цены (`fromMinorUnits`/
 * `toMinorUnits`, Currency System, ROADMAP.md §8), только «остаток» товара
 * заменён на обязательную «длительность» услуги. */
export function ServiceFormModal({
  businessId,
  currency,
  service,
  onSaved,
  onClose,
}: ServiceFormModalProps) {
  const currencyMetadata = getCurrencyMetadata(currency);
  const [name, setName] = useState(service?.name ?? '');
  const [price, setPrice] = useState(service ? fromMinorUnits(service.priceCents, currency) : '');
  const [duration, setDuration] = useState(service ? String(service.durationMinutes) : '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [image, setImage] = useState<string | null>(service?.images[0] ?? null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название услуги');
      return;
    }
    const priceCents = toMinorUnits(price, currency);
    if (priceCents === null) {
      setError('Введите корректную цену');
      return;
    }
    const durationMinutes = parseDuration(duration);
    if (durationMinutes === null) {
      setError('Длительность должна быть числом минут, не меньше 5');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        priceCents,
        durationMinutes,
        description: description.trim(),
        isActive,
        images: image ? [image] : [],
      };
      if (service) {
        await updateService(businessId, service.id, input);
      } else {
        await createService(businessId, input);
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить услугу');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={service ? 'Редактировать услугу' : 'Новая услуга'}
      className={styles.modal}
    >
      <h2 className={styles.title}>{service ? 'Редактировать услугу' : 'Новая услуга'}</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <ServiceImageField value={image} onChange={setImage} businessId={businessId} />

        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Стрижка"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Цена, {currencyMetadata.symbol} ({currencyMetadata.code})
          </span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder={currencyMetadata.minorUnit === 0 ? '1500' : '1500.00'}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Длительность, мин</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="45"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Описание</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Стрижка машинкой и ножницами, укладка"
          />
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Показывать на сайте</span>
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
            {isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
