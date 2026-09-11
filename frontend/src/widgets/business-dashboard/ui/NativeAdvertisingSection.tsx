'use client';

import { useCallback, useState } from 'react';
import type { Business } from '@/entities/business';
import {
  AD_BILLING_MODEL_LABELS,
  getNativeAdCampaigns,
  NATIVE_AD_CAMPAIGN_STATUS_LABELS,
  removeNativeAdCreative,
  submitNativeAdCampaignForReview,
  type NativeAdCampaign,
} from '@/entities/native-ad';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import { StripePaymentForm } from '@/shared/ui/StripePaymentForm';
import { CheckIcon, MegaphoneIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { NativeAdCampaignFormModal } from './NativeAdCampaignFormModal';
import { NativeAdCreativeFormModal } from './NativeAdCreativeFormModal';
import { NativeAdRevenueBreakdown } from './NativeAdRevenueBreakdown';
// Тот же shape/статусы (`draft|pending_review|active|paused|rejected|
// completed`), что и у сайтовой рекламы — переиспользуем готовый SCSS-модуль
// напрямую, не дублируем его один в один ради другого имени.
import styles from './AdvertisingSection.module.scss';

export interface NativeAdvertisingSectionProps {
  business: Business;
}

/**
 * Self-service реклама в ленте creator'ов (Creator Monetization Phase 2,
 * AI_PLATFORM_ROADMAP.md §80) — точное зеркало `AdvertisingSection`
 * (сайтовая реклама), другой backend-модуль (`native-ad-campaigns`), не
 * гейтится капабилити, тот же принцип. После оплаты и одобрения админом
 * кампания НЕ начинает показываться автоматически — нужно ещё, чтобы админ
 * вручную назначил её конкретным creator'ам (Phase 2 — "no AI yet", см.
 * корневой план фичи); это происходит в админ-панели, не здесь.
 */
export function NativeAdvertisingSection({ business }: NativeAdvertisingSectionProps) {
  const fetcher = useCallback(() => getNativeAdCampaigns(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isCreating, setCreating] = useState(false);
  const [addingCreativeFor, setAddingCreativeFor] = useState<NativeAdCampaign | null>(null);
  const [payingCampaign, setPayingCampaign] = useState<NativeAdCampaign | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [removingCreativeId, setRemovingCreativeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSubmitForReview(campaign: NativeAdCampaign) {
    setSubmittingId(campaign.id);
    setActionError(null);
    try {
      const updated = await submitNativeAdCampaignForReview(business.id, campaign.id);
      await refetch();
      if (updated.clientSecret) {
        setPayingCampaign(updated);
      }
    } catch (submitError) {
      setActionError(
        submitError instanceof Error ? submitError.message : 'Не удалось отправить на модерацию',
      );
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleRemoveCreative(campaignId: string, creativeId: string) {
    setRemovingCreativeId(creativeId);
    setActionError(null);
    try {
      await removeNativeAdCreative(business.id, campaignId, creativeId);
      await refetch();
    } catch (removeError) {
      setActionError(
        removeError instanceof Error ? removeError.message : 'Не удалось удалить креатив',
      );
    } finally {
      setRemovingCreativeId(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем рекламные кампании…" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <p className={styles.hint}>
          Оплаченная и одобренная кампания показывается в ленте у creator&rsquo;ов, которых вручную
          подберёт администратор — это не баннер на сайте, а нативная карточка среди их постов.
        </p>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon />
          Создать кампанию
        </Button>
      </div>

      {actionError && (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одной кампании в ленте"
          description="Создайте кампанию, добавьте креатив и отправьте на модерацию — администратор подберёт подходящих creator'ов."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((campaign) => (
            <li key={campaign.id} className={styles.card}>
              <div className={styles.card__head}>
                <span className={styles.card__title}>{campaign.name}</span>
                <span className={`${styles.badge} ${styles[`badge--${campaign.status}`]}`}>
                  {NATIVE_AD_CAMPAIGN_STATUS_LABELS[campaign.status]}
                </span>
              </div>

              <div className={styles.card__meta}>
                <span>
                  Бюджет {formatMoney(campaign.spentCents, campaign.currency)} /{' '}
                  {formatMoney(campaign.budgetCents, campaign.currency)}
                </span>
                <span>
                  {AD_BILLING_MODEL_LABELS[campaign.billingModel]} ·{' '}
                  {formatMoney(campaign.bidCents, campaign.currency)}
                </span>
                <span>
                  {campaign.impressionsServed} показов · {campaign.clicksServed} кликов
                </span>
              </div>

              {campaign.status === 'rejected' && campaign.rejectionReason && (
                <p className={styles.card__reason}>Причина отказа: {campaign.rejectionReason}</p>
              )}

              {(campaign.status === 'active' || campaign.status === 'paused') && (
                <NativeAdRevenueBreakdown businessId={business.id} campaignId={campaign.id} />
              )}

              {campaign.creatives.length > 0 && (
                <ul className={styles.creatives}>
                  {campaign.creatives.map((creative) => (
                    <li key={creative.id} className={styles.creative}>
                      <div className={styles['creative__image']}>
                        {creative.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- превью загруженного креатива
                          <img src={creative.imageUrl} alt="" />
                        ) : (
                          <MegaphoneIcon />
                        )}
                      </div>
                      <div className={styles['creative__body']}>
                        <span className={styles['creative__title']}>{creative.headline}</span>
                        <span className={styles['creative__meta']}>
                          {creative.status === 'rejected'
                            ? `Отклонён администратором${creative.rejectionReason ? `: ${creative.rejectionReason}` : ''}`
                            : creative.targetUrl}
                        </span>
                      </div>
                      {campaign.status === 'draft' && (
                        <button
                          type="button"
                          className={styles['creative__action']}
                          aria-label={`Удалить креатив «${creative.headline}»`}
                          disabled={removingCreativeId === creative.id}
                          onClick={() => void handleRemoveCreative(campaign.id, creative.id)}
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {campaign.status === 'draft' && (
                <div className={styles.card__actions}>
                  <Button variant="outline" onClick={() => setAddingCreativeFor(campaign)}>
                    <PlusIcon />
                    Добавить креатив
                  </Button>
                  <Button
                    disabled={campaign.creatives.length === 0 || submittingId === campaign.id}
                    onClick={() => void handleSubmitForReview(campaign)}
                  >
                    <CheckIcon />
                    {submittingId === campaign.id ? 'Отправляем…' : 'Отправить на модерацию'}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCreating && (
        <NativeAdCampaignFormModal
          businessId={business.id}
          currency={business.currency}
          onSaved={() => {
            setCreating(false);
            void refetch();
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {addingCreativeFor && (
        <NativeAdCreativeFormModal
          businessId={business.id}
          campaignId={addingCreativeFor.id}
          onSaved={() => {
            setAddingCreativeFor(null);
            void refetch();
          }}
          onClose={() => setAddingCreativeFor(null)}
        />
      )}

      {payingCampaign && payingCampaign.clientSecret && (
        <Modal
          onClose={() => setPayingCampaign(null)}
          label="Оплата рекламной кампании"
          className={styles.paymentModal}
        >
          <h2 className={styles['paymentModal__title']}>Оплата кампании «{payingCampaign.name}»</h2>
          <p className={styles['paymentModal__hint']}>
            Спишем {formatMoney(payingCampaign.budgetCents, payingCampaign.currency)} — кампания
            начнёт показываться после одобрения администратором и ручного назначения
            creator&rsquo;ов.
          </p>
          <StripePaymentForm
            clientSecret={payingCampaign.clientSecret}
            submitLabel="Оплатить и отправить на модерацию"
            onPaid={() => {
              setPayingCampaign(null);
              void refetch();
            }}
          />
        </Modal>
      )}
    </>
  );
}
