'use client';

import { useState, type FormEvent } from 'react';
import {
  CREATOR_BLOCKABLE_AD_CATEGORIES,
  CREATOR_BLOCKABLE_AD_CATEGORY_LABELS,
} from '@/entities/creator';
import {
  AD_BILLING_MODEL_LABELS,
  createNativeAdCampaign,
  type AdBillingModel,
} from '@/entities/native-ad';
import { getCurrencyMetadata } from '@/shared/config/currencies';
import { toMinorUnits } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import formStyles from './ProductFormModal.module.scss';

export interface NativeAdCampaignFormModalProps {
  businessId: string;
  currency: string;
  onSaved: () => void;
  onClose: () => void;
}

/** Создание — единственная операция над кампанией, тот же принцип, что
 * `AdCampaignFormModal` (сайтовая реклама): редактируется только состав
 * креативов, пока кампания в статусе `draft`. Без пикера
 * `targetCategoryIds`/`targetGeography` — в Phase 2 это чисто
 * информационные поля для админа при РУЧНОМ назначении (см. backend
 * `NativeAdCampaign`'s комментарий), не критерий автоматического подбора;
 * строить полноценный пикер категорий creator'ов ради поля, которое пока
 * ни на что не влияет, было бы преждевременно — добавится вместе с Phase 3
 * (AI-подбор), когда таргетинг реально заработает. */
export function NativeAdCampaignFormModal({
  businessId,
  currency,
  onSaved,
  onClose,
}: NativeAdCampaignFormModalProps) {
  const currencyMetadata = getCurrencyMetadata(currency);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [billingModel, setBillingModel] = useState<AdBillingModel>('cpm');
  const [bid, setBid] = useState('');
  const [adCategory, setAdCategory] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название кампании');
      return;
    }
    const budgetCents = toMinorUnits(budget, currency);
    if (budgetCents === null || budgetCents < 100) {
      setError('Введите бюджет, минимум $1 (эквивалент в вашей валюте)');
      return;
    }
    const bidCents = toMinorUnits(bid, currency);
    if (bidCents === null || bidCents < 1) {
      setError('Введите ставку больше 0');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createNativeAdCampaign(businessId, {
        name: name.trim(),
        budgetCents,
        billingModel,
        bidCents,
        adCategory: adCategory || undefined,
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать кампанию');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Новая кампания в ленте creator'ов" className={formStyles.modal}>
      <h2 className={formStyles.title}>Новая кампания в ленте creator&rsquo;ов</h2>

      <form className={formStyles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Название кампании</span>
          <input
            type="text"
            className={formStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Запуск нового продукта"
            autoFocus
          />
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>
            Бюджет, {currencyMetadata.symbol} ({currencyMetadata.code})
          </span>
          <input
            type="text"
            inputMode="decimal"
            className={formStyles.input}
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="1000"
          />
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>Модель оплаты</span>
          <select
            className={formStyles.input}
            value={billingModel}
            onChange={(event) => setBillingModel(event.target.value as AdBillingModel)}
          >
            {(Object.entries(AD_BILLING_MODEL_LABELS) as [AdBillingModel, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>
            {billingModel === 'cpm'
              ? `Ставка за 1000 показов, ${currencyMetadata.symbol}`
              : `Ставка за клик, ${currencyMetadata.symbol}`}
          </span>
          <input
            type="text"
            inputMode="decimal"
            className={formStyles.input}
            value={bid}
            onChange={(event) => setBid(event.target.value)}
            placeholder={billingModel === 'cpm' ? '50' : '5'}
          />
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>
            Категория рекламы (для creator&rsquo;ов, заблокировавших определённые темы)
          </span>
          <select
            className={formStyles.input}
            value={adCategory}
            onChange={(event) => setAdCategory(event.target.value)}
          >
            <option value="">Не классифицировано</option>
            {CREATOR_BLOCKABLE_AD_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CREATOR_BLOCKABLE_AD_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Создаём…' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
