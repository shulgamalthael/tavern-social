'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { BUSINESS_CATEGORIES, createBusiness, type BusinessCategory } from '@/entities/business';
import { CURRENCY_OPTIONS, DEFAULT_BUSINESS_CURRENCY } from '@/shared/config/currencies';
import { Button } from '@/shared/ui/Button';
import styles from './CreateBusinessForm.module.scss';

/**
 * Форма ручного создания бизнеса — минимум обязательных полей (только
 * название и категория), остальное (описание, контакты, соцсети, SEO)
 * правится потом на самой странице бизнеса — не нагружаем самый первый экран
 * created-flow длинной формой ради «хорошего первого впечатления» (см.
 * корневой план фичи). После создания сразу открывает билдер
 * (`/business/[id]/edit`) — у нового бизнеса сайт уже существует (пустой, см.
 * `BusinessesService.create` на backend), так что там сразу встретит
 * `StarterTemplatePicker`.
 *
 * Валюта (Currency System, ROADMAP.md §8) — обязательное поле здесь, не
 * "необязательно, поправите потом", как описание: это единственная точка
 * входа, где бизнес ещё не существует, поэтому нечему "молча подставить
 * UAH, пока не заметили" — выбор явный с самого начала, дефолт `UAH`
 * только предзаполняет select, не скрывает решение.
 *
 * Не владеет заголовком/шапкой раздела — это делает `NewBusinessFlow`
 * (единственный вызывающий, AI-4, AI_PLATFORM_ROADMAP.md §2.7), т.к. форма
 * теперь один из двух режимов ("вручную"/"с AI") одной страницы `/businesses
 * /new`, и `<main>`-обёртка (`SectionContainer`) должна быть ровно одна.
 */
export function CreateBusinessForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BusinessCategory>(BUSINESS_CATEGORIES[0].id);
  const [currency, setCurrency] = useState(DEFAULT_BUSINESS_CURRENCY);
  const [description, setDescription] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Введите название бизнеса');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const business = await createBusiness({
        name: name.trim(),
        category,
        currency,
        description: description.trim() || undefined,
      });
      router.push(`/business/${business.id}/edit`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать бизнес');
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
      <label className={styles.field}>
        <span className={styles['field__label']}>Название</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Например, «Кофейня на Хрещатику»"
          maxLength={80}
          autoFocus
        />
      </label>

      <label className={styles.field}>
        <span className={styles['field__label']}>Категория</span>
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
        <span className={styles['field__label']}>Валюта</span>
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
          {CURRENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles['field__label']}>Описание (необязательно)</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Чем занимается бизнес — пригодится в шаблоне сайта"
          rows={3}
          maxLength={280}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? 'Создаём…' : 'Создать и перейти в конструктор'}
      </Button>
    </form>
  );
}
