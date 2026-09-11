'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BUSINESS_CATEGORIES, createBusiness, type BusinessCategory } from '@/entities/business';
import { CURRENCY_OPTIONS, DEFAULT_BUSINESS_CURRENCY } from '@/shared/config/currencies';
import { Button } from '@/shared/ui/Button';
import styles from './CreateBusinessForm.module.scss';

/**
 * Облегчённый кабинет внешнего рекламодателя (`/advertise/new`,
 * AI_PLATFORM_ROADMAP.md §71) — сознательно НЕ `CreateBusinessForm`: то же
 * самое `createBusiness`, но `isAdvertiserOnly: true` и без поля описания
 * (сайт этому бизнесу никогда не понадобится, описание для шаблона сайта —
 * лишнее поле). Категория здесь — не "какой у вас бизнес", а "на рекламе
 * какой категории не показывать вашу рекламу" (см. `AdEngineService`'s
 * конкурентное исключение) — подпись поля переформулирована под эту
 * аудиторию, значения те же самые `BUSINESS_CATEGORIES`, не новый список.
 * Ведёт сразу в `/business/[id]/dashboard` — у рекламодателя нет тарифа,
 * который нужно выбрать (`/plan` и `/edit` его вообще не касаются, см. их
 * гейты), и нет билдера, к которому вело бы `CreateBusinessForm`.
 */
export function AdvertiserSignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('other');
  const [currency, setCurrency] = useState(DEFAULT_BUSINESS_CURRENCY);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Введите название рекламодателя');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const business = await createBusiness({
        name: name.trim(),
        category,
        currency,
        isAdvertiserOnly: true,
      });
      router.push(`/business/${business.id}/dashboard`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать кабинет');
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
      <label className={styles.field}>
        <span className={styles['field__label']}>Название рекламодателя</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Например, «ООО Ромашка» или ваш бренд"
          maxLength={80}
          autoFocus
        />
      </label>

      <label className={styles.field}>
        <span className={styles['field__label']}>
          Категория (чтобы не показывать вашу рекламу конкурентам)
        </span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as BusinessCategory)}
        >
          {BUSINESS_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles['field__label']}>Валюта оплаты кампаний</span>
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? 'Создаём…' : 'Создать кабинет рекламодателя'}
      </Button>
    </form>
  );
}
