'use client';

import { useState, type FormEvent } from 'react';
import { topUpAdCampaign, type AdCampaign } from '@/entities/advertising';
import { getCurrencyMetadata } from '@/shared/config/currencies';
import { formatMoney, toMinorUnits } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import formStyles from './ProductFormModal.module.scss';
import hintStyles from './AdCampaignTopUpModal.module.scss';

export interface AdCampaignTopUpModalProps {
  businessId: string;
  campaign: AdCampaign;
  onTopUp: (updated: AdCampaign) => void;
  onClose: () => void;
}

/** Доплата бюджета к `paused`-кампании (см. backend `AdCampaignsService.
 * requestTopUp`'s комментарий) — только сумма, ничего больше: кампания уже
 * прошла модерацию/таргетинг раньше, доплата не переоткрывает эти поля.
 * Возвращает через `onTopUp` кампанию с заполненным `clientSecret` —
 * дальнейшую оплату (`StripePaymentForm`) показывает уже `AdvertisingSection`,
 * тот же переиспользуемый приём, что и у `submitAdCampaignForReview`. */
export function AdCampaignTopUpModal({
  businessId,
  campaign,
  onTopUp,
  onClose,
}: AdCampaignTopUpModalProps) {
  const currencyMetadata = getCurrencyMetadata(campaign.currency);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const amountCents = toMinorUnits(amount, campaign.currency);
    if (amountCents === null || amountCents < 100) {
      setError('Введите сумму, минимум $1 (эквивалент в вашей валюте)');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await topUpAdCampaign(businessId, campaign.id, amountCents);
      onTopUp(updated);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать доплату');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Доплата бюджета" className={formStyles.modal}>
      <h2 className={formStyles.title}>Доплатить бюджет кампании «{campaign.name}»</h2>
      <p className={hintStyles.hint}>
        Потрачено {formatMoney(campaign.spentCents, campaign.currency)} из{' '}
        {formatMoney(campaign.budgetCents, campaign.currency)} — доплата увеличит бюджет и снова
        включит показ, если её хватит покрыть уже потраченное.
      </p>

      <form className={formStyles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>
            Сумма доплаты, {currencyMetadata.symbol} ({currencyMetadata.code})
          </span>
          <input
            type="text"
            inputMode="decimal"
            className={formStyles.input}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="500"
            autoFocus
          />
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
            {isSubmitting ? 'Создаём платёж…' : 'Продолжить к оплате'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
