'use client';

import { useState, type FormEvent } from 'react';
import {
  createDiscount,
  updateDiscount,
  type Discount,
  type DiscountType,
} from '@/entities/discount';
import { getCurrencyMetadata } from '@/shared/config/currencies';
import { fromMinorUnits, toMinorUnits } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import styles from './ProductFormModal.module.scss';

export interface DiscountFormModalProps {
  businessId: string;
  /** Валюта бизнеса — только для показа/конвертации `value` типа `fixed`
   * (тот же принцип, что `currency` в `ProductFormModal`): значение
   * `percentage`-скидки не денежное, конвертации не требует. */
  currency: string;
  /** `null` — создание новой скидки, иначе — редактирование существующей. */
  discount: Discount | null;
  onSaved: () => void;
  onClose: () => void;
}

/** `Date` → `yyyy-MM-dd` для `<input type="date">` — обратное направление
 * (submit) собирает конец дня в UTC, чтобы `endsAt` включал весь выбранный
 * день, а не обрывался в полночь. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function DiscountFormModal({
  businessId,
  currency,
  discount,
  onSaved,
  onClose,
}: DiscountFormModalProps) {
  const currencyMetadata = getCurrencyMetadata(currency);
  const [name, setName] = useState(discount?.name ?? '');
  const [code, setCode] = useState(discount?.code ?? '');
  const [type, setType] = useState<DiscountType>(discount?.type ?? 'percentage');
  const [value, setValue] = useState(
    discount
      ? discount.type === 'fixed'
        ? fromMinorUnits(discount.value, currency)
        : String(discount.value)
      : '',
  );
  const [minOrderAmount, setMinOrderAmount] = useState(
    discount?.minOrderAmountCents != null
      ? fromMinorUnits(discount.minOrderAmountCents, currency)
      : '',
  );
  const [startsAt, setStartsAt] = useState(toDateInputValue(discount?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDateInputValue(discount?.endsAt ?? null));
  const [usageLimit, setUsageLimit] = useState(
    discount?.usageLimit != null ? String(discount.usageLimit) : '',
  );
  const [isActive, setIsActive] = useState(discount?.isActive ?? true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название скидки');
      return;
    }

    let parsedValue: number | null;
    if (type === 'percentage') {
      const parsed = Number(value.trim());
      parsedValue = Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null;
    } else {
      parsedValue = toMinorUnits(value, currency);
    }
    if (parsedValue === null) {
      setError(
        type === 'percentage' ? 'Введите целое число от 1 до 100' : 'Введите корректную сумму',
      );
      return;
    }

    let minOrderAmountCents: number | undefined;
    if (minOrderAmount.trim()) {
      const parsed = toMinorUnits(minOrderAmount, currency);
      if (parsed === null) {
        setError('Минимальная сумма заказа введена некорректно');
        return;
      }
      minOrderAmountCents = parsed;
    }

    let parsedUsageLimit: number | undefined;
    if (usageLimit.trim()) {
      const parsed = Number(usageLimit.trim());
      if (!Number.isInteger(parsed) || parsed < 1) {
        setError('Лимит использований должен быть целым числом не меньше 1');
        return;
      }
      parsedUsageLimit = parsed;
    }

    setSubmitting(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : undefined,
        type,
        value: parsedValue,
        minOrderAmountCents,
        startsAt: startsAt ? new Date(`${startsAt}T00:00:00.000Z`).toISOString() : undefined,
        endsAt: endsAt ? new Date(`${endsAt}T23:59:59.999Z`).toISOString() : undefined,
        usageLimit: parsedUsageLimit,
        isActive,
      };
      if (discount) {
        await updateDiscount(businessId, discount.id, {
          ...input,
          code: input.code ?? null,
          minOrderAmountCents: input.minOrderAmountCents ?? null,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          usageLimit: input.usageLimit ?? null,
        });
      } else {
        await createDiscount(businessId, input);
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить скидку');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={discount ? 'Редактировать скидку' : 'Новая скидка'}
      className={styles.modal}
    >
      <h2 className={styles.title}>{discount ? 'Редактировать скидку' : 'Новая скидка'}</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Скидка выходного дня"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Промокод (необязательно)</span>
          <input
            type="text"
            className={styles.input}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Пусто — скидка применяется автоматически"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Тип скидки</span>
          <select
            className={styles.input}
            value={type}
            onChange={(event) => setType(event.target.value as DiscountType)}
          >
            <option value="percentage">Процент от суммы заказа</option>
            <option value="fixed">Фиксированная сумма</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            {type === 'percentage'
              ? 'Размер скидки, %'
              : `Размер скидки, ${currencyMetadata.symbol}`}
          </span>
          <input
            type="text"
            inputMode={type === 'percentage' ? 'numeric' : 'decimal'}
            className={styles.input}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={type === 'percentage' ? '20' : '500'}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Минимальная сумма заказа, {currencyMetadata.symbol} (необязательно)
          </span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={minOrderAmount}
            onChange={(event) => setMinOrderAmount(event.target.value)}
            placeholder="Без минимума"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Действует с (необязательно)</span>
          <input
            type="date"
            className={styles.input}
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Действует по (необязательно)</span>
          <input
            type="date"
            className={styles.input}
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Лимит использований (необязательно)</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={usageLimit}
            onChange={(event) => setUsageLimit(event.target.value)}
            placeholder="Без ограничения"
          />
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span>Скидка активна</span>
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
