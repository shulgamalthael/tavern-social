'use client';

import { useState, type FormEvent } from 'react';
import { createProduct, updateProduct, type Product } from '@/entities/product';
import { getCurrencyMetadata } from '@/shared/config/currencies';
import { fromMinorUnits, toMinorUnits } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { ProductImageField } from './ProductImageField';
import styles from './ProductFormModal.module.scss';

export interface ProductFormModalProps {
  businessId: string;
  /** Валюта бизнеса (Currency System, ROADMAP.md §8) — только для показа
   * (метка поля цены) и конвертации ввода в минимальные единицы; сама
   * валюта здесь не редактируется, менять её можно только в Business
   * Settings (см. `BusinessCurrencySection.tsx`), не из карточки товара. */
  currency: string;
  /** `null` — создание нового товара, иначе — редактирование существующего. */
  product: Product | null;
  onSaved: () => void;
  onClose: () => void;
}

/** `undefined` — поле пустое (остаток не отслеживается), `null` — введено
 * что-то нечисловое (ошибка ввода, не то же самое, что «пусто»!). Различать
 * их обязательно: не различая, `Number('abc')` дал бы `NaN`, который при
 * сериализации в JSON тихо превращается в `null` — невалидный ввод выглядел
 * бы как «сохранено успешно», а не как ошибка. */
function parseStock(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function ProductFormModal({
  businessId,
  currency,
  product,
  onSaved,
  onClose,
}: ProductFormModalProps) {
  const currencyMetadata = getCurrencyMetadata(currency);
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? fromMinorUnits(product.priceCents, currency) : '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [stock, setStock] = useState(product?.stock != null ? String(product.stock) : '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [image, setImage] = useState<string | null>(product?.images[0] ?? null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название товара');
      return;
    }
    const priceCents = toMinorUnits(price, currency);
    if (priceCents === null) {
      setError('Введите корректную цену');
      return;
    }
    const parsedStock = parseStock(stock);
    if (parsedStock === null) {
      setError('Остаток должен быть целым неотрицательным числом');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        priceCents,
        description: description.trim(),
        stock: parsedStock ?? null,
        isActive,
        images: image ? [image] : [],
      };
      if (product) {
        await updateProduct(businessId, product.id, input);
      } else {
        await createProduct(businessId, input);
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить товар');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={product ? 'Редактировать товар' : 'Новый товар'}
      className={styles.modal}
    >
      <h2 className={styles.title}>{product ? 'Редактировать товар' : 'Новый товар'}</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <ProductImageField value={image} onChange={setImage} businessId={businessId} />

        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Кофе зерновой"
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
            placeholder={currencyMetadata.minorUnit === 0 ? '899' : '899.00'}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Описание</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Арабика, 250 г"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Остаток на складе (необязательно)</span>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            placeholder="Не отслеживается"
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
