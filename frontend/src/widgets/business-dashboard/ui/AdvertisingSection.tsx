'use client';

import { useCallback, useState } from 'react';
import {
  AD_BILLING_MODEL_LABELS,
  AD_CAMPAIGN_STATUS_LABELS,
  AD_PLACEMENT_LABELS,
  getAdCampaigns,
  removeAdCreative,
  submitAdCampaignForReview,
  type AdCampaign,
} from '@/entities/advertising';
import type { Business } from '@/entities/business';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import { StripePaymentForm } from '@/shared/ui/StripePaymentForm';
import { CheckIcon, MegaphoneIcon, PlusIcon, TrashIcon, WalletIcon } from '@/shared/ui/icons';
import { AdCampaignFormModal } from './AdCampaignFormModal';
import { AdCampaignTopUpModal } from './AdCampaignTopUpModal';
import { AdCreativeFormModal } from './AdCreativeFormModal';
import styles from './AdvertisingSection.module.scss';

export interface AdvertisingSectionProps {
  business: Business;
}

/**
 * Self-service реклама (корневой план фичи, «Campaigns are self-service —
 * любой Business», согласовано с владельцем) — единственная фронтенд-точка
 * входа в весь `AdvertisingModule` бэкенда для рекламодателя (паблишер-
 * сторона живёт отдельно, в Builder-блоке `adslot`). Не гейтится
 * капабилити (тот же принцип, что «Заявки»/«Автоматизация» — см. комментарий
 * `BusinessDashboardWidget`): создание кампании не завязано ни на одну
 * `Business.capabilities`.
 */
export function AdvertisingSection({ business }: AdvertisingSectionProps) {
  const fetcher = useCallback(() => getAdCampaigns(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isCreating, setCreating] = useState(false);
  const [addingCreativeFor, setAddingCreativeFor] = useState<AdCampaign | null>(null);
  const [toppingUpCampaign, setToppingUpCampaign] = useState<AdCampaign | null>(null);
  const [payingCampaign, setPayingCampaign] = useState<AdCampaign | null>(null);
  // Тот же платёжный модал (`StripePaymentForm` ниже), что и для оплаты при
  // создании — но подсказка над формой должна отличаться (доплата не ждёт
  // повторной модерации), поэтому запоминаем, каким путём мы сюда попали.
  const [isTopUpPayment, setTopUpPayment] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [removingCreativeId, setRemovingCreativeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleSubmitForReview(campaign: AdCampaign) {
    setSubmittingId(campaign.id);
    setActionError(null);
    try {
      const updated = await submitAdCampaignForReview(business.id, campaign.id);
      await refetch();
      // `clientSecret` заполнен только в этом ответе (см. `AdCampaign`'s
      // комментарий) — список после `refetch` его уже не содержит.
      if (updated.clientSecret) {
        setTopUpPayment(false);
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

  function handleTopUpCreated(updated: AdCampaign) {
    setToppingUpCampaign(null);
    if (updated.clientSecret) {
      setTopUpPayment(true);
      setPayingCampaign(updated);
    }
  }

  async function handleRemoveCreative(campaignId: string, creativeId: string) {
    setRemovingCreativeId(creativeId);
    setActionError(null);
    try {
      await removeAdCreative(business.id, campaignId, creativeId);
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
          Оплаченная кампания показывается на других сайтах платформы — после отправки на модерацию
          администратор проверяет содержимое и включает показ.
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
          title="Пока нет ни одной рекламной кампании"
          description="Создайте кампанию, добавьте креатив и отправьте на модерацию — покажем её на других сайтах платформы."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((campaign) => (
            <li key={campaign.id} className={styles.card}>
              <div className={styles.card__head}>
                <span className={styles.card__title}>{campaign.name}</span>
                <span className={`${styles.badge} ${styles[`badge--${campaign.status}`]}`}>
                  {AD_CAMPAIGN_STATUS_LABELS[campaign.status]}
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
                  {campaign.targetPlacements.map((p) => AD_PLACEMENT_LABELS[p]).join(', ')}
                </span>
                <span>
                  {campaign.impressionsServed} показов · {campaign.clicksServed} кликов
                </span>
              </div>

              {campaign.status === 'rejected' && campaign.rejectionReason && (
                <p className={styles.card__reason}>Причина отказа: {campaign.rejectionReason}</p>
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
                        <span className={styles['creative__title']}>
                          {creative.headline}
                          {creative.productId && (
                            <span className={styles['creative__product-badge']}>🔗 Товар</span>
                          )}
                        </span>
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

              {/* `paused` сегодня попадает сюда только автоматически, при
                  исчерпании бюджета (см. backend `AdCampaignsService.
                  applySpend`) — доплата (`AdCampaignTopUpModal`) её снова
                  запускает без повторной модерации. */}
              {campaign.status === 'paused' && (
                <div className={styles.card__actions}>
                  <Button variant="outline" onClick={() => setToppingUpCampaign(campaign)}>
                    <WalletIcon />
                    Доплатить бюджет
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCreating && (
        <AdCampaignFormModal
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
        <AdCreativeFormModal
          businessId={business.id}
          campaignId={addingCreativeFor.id}
          onSaved={() => {
            setAddingCreativeFor(null);
            void refetch();
          }}
          onClose={() => setAddingCreativeFor(null)}
        />
      )}

      {toppingUpCampaign && (
        <AdCampaignTopUpModal
          businessId={business.id}
          campaign={toppingUpCampaign}
          onTopUp={handleTopUpCreated}
          onClose={() => setToppingUpCampaign(null)}
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
            {isTopUpPayment
              ? 'Спишем доплату — как только платёж пройдёт, бюджет кампании увеличится и, если этого хватит, показ возобновится.'
              : `Спишем ${formatMoney(payingCampaign.budgetCents, payingCampaign.currency)} — кампания начнёт показываться после одобрения администратором.`}
          </p>
          <StripePaymentForm
            clientSecret={payingCampaign.clientSecret}
            submitLabel={isTopUpPayment ? 'Оплатить доплату' : 'Оплатить и отправить на модерацию'}
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
