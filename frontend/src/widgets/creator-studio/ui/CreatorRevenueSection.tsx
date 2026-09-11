'use client';

import { useCallback, useState } from 'react';
import {
  CREATOR_STRIPE_CONNECT_STATUS_LABELS,
  refreshStripeConnectStatus,
  startStripeConnectOnboarding,
  type CreatorProfile,
} from '@/entities/creator';
import {
  getMyNativeAdPayouts,
  getMyNativeRevenue,
  requestNativeAdPayout,
  NATIVE_AD_PAYOUT_STATUS_LABELS,
} from '@/entities/native-ad';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './CreatorRevenueSection.module.scss';

export interface CreatorRevenueSectionProps {
  profile: CreatorProfile;
  onProfileChange: (profile: CreatorProfile) => void;
}

/**
 * Реальная агрегация ledger'а (`NativeAdRevenueEvent`, Creator Monetization
 * Phase 4, см. AI_PLATFORM_ROADMAP.md §82) + реальные выплаты через Stripe
 * Connect (Phase 5, §83). Три честных состояния подключения выплат
 * (`not_connected`/`onboarding`/`active`, см. `CreatorStripeConnectStatus`'s
 * комментарий) — до `active` кнопка «Запросить выплату» просто не
 * показывается, накопленный баланс при этом уже виден.
 */
export function CreatorRevenueSection({ profile, onProfileChange }: CreatorRevenueSectionProps) {
  const revenueFetcher = useCallback(() => getMyNativeRevenue(), []);
  const revenue = useAsyncData(revenueFetcher);
  const payoutsFetcher = useCallback(() => getMyNativeAdPayouts(), []);
  const payouts = useAsyncData(payoutsFetcher);

  const [isConnecting, setConnecting] = useState(false);
  const [isCheckingStatus, setCheckingStatus] = useState(false);
  const [requestingCurrency, setRequestingCurrency] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const { url } = await startStripeConnectOnboarding();
      window.location.href = url;
    } catch (error) {
      setConnectError(
        error instanceof Error ? error.message : 'Не удалось начать подключение Stripe',
      );
      setConnecting(false);
    }
  }

  async function handleCheckStatus() {
    setCheckingStatus(true);
    setConnectError(null);
    try {
      const { status } = await refreshStripeConnectStatus();
      onProfileChange({ ...profile, stripeConnectStatus: status });
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Не удалось проверить статус');
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleRequestPayout(currency: string) {
    setRequestingCurrency(currency);
    setPayoutError(null);
    try {
      await requestNativeAdPayout(currency);
      await Promise.all([revenue.refetch(), payouts.refetch()]);
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : 'Не удалось запросить выплату');
    } finally {
      setRequestingCurrency(null);
    }
  }

  return (
    <div className={styles.list}>
      <Card className={styles.card}>
        <span className={styles['card__label']}>Выплаты через Stripe</span>
        <span className={styles.connectStatus}>
          {CREATOR_STRIPE_CONNECT_STATUS_LABELS[profile.stripeConnectStatus]}
        </span>

        {profile.stripeConnectStatus === 'not_connected' && (
          <p className={styles.hint}>
            Подключите выплаты, чтобы выводить начисленный баланс на карту или счёт.
          </p>
        )}
        {profile.stripeConnectStatus === 'onboarding' && (
          <p className={styles.hint}>
            Онбординг Stripe не завершён — продолжите его или проверьте актуальный статус.
          </p>
        )}

        {connectError && (
          <p className={styles.error} role="alert">
            {connectError}
          </p>
        )}

        {profile.stripeConnectStatus !== 'active' && (
          <div className={styles.row}>
            <Button disabled={isConnecting} onClick={() => void handleConnect()}>
              {isConnecting
                ? 'Открываем Stripe…'
                : profile.stripeConnectStatus === 'onboarding'
                  ? 'Продолжить онбординг'
                  : 'Подключить выплаты через Stripe'}
            </Button>
            {profile.stripeConnectStatus === 'onboarding' && (
              <Button
                variant="outline"
                disabled={isCheckingStatus}
                onClick={() => void handleCheckStatus()}
              >
                {isCheckingStatus ? 'Проверяем…' : 'Проверить статус'}
              </Button>
            )}
          </div>
        )}
      </Card>

      {revenue.status === 'loading' && <Loader label="Считаем доход…" />}
      {revenue.status === 'error' && (
        <ErrorState message={revenue.error} onRetry={revenue.refetch} />
      )}
      {revenue.status === 'success' && revenue.data && revenue.data.byCurrency.length === 0 && (
        <p className={styles.hint}>
          Доход пока не начислялся — реклама появится в вашем контенте, когда администратор назначит
          подходящую кампанию.
        </p>
      )}
      {revenue.status === 'success' &&
        revenue.data &&
        revenue.data.byCurrency.map((row) => (
          <Card key={row.currency} className={styles.card}>
            <span className={styles['card__amount']}>
              {formatMoney(row.earnedCents, row.currency)}
            </span>
            <span className={styles['card__label']}>Начислено всего</span>
            <span className={styles['card__meta']}>
              {row.impressions} показов · {row.clicks} кликов
            </span>
            <span className={styles.available}>
              Доступно к выплате: {formatMoney(row.availableCents, row.currency)}
            </span>
            {profile.stripeConnectStatus === 'active' && row.availableCents > 0 && (
              <Button
                variant="outline"
                disabled={requestingCurrency === row.currency}
                onClick={() => void handleRequestPayout(row.currency)}
              >
                {requestingCurrency === row.currency ? 'Отправляем…' : 'Запросить выплату'}
              </Button>
            )}
          </Card>
        ))}
      {payoutError && (
        <p className={styles.error} role="alert">
          {payoutError}
        </p>
      )}

      {payouts.status === 'success' && payouts.data && payouts.data.length > 0 && (
        <Card className={styles.card}>
          <span className={styles['card__label']}>История выплат</span>
          <ul className={styles.payoutList}>
            {payouts.data.map((payout) => (
              <li key={payout.id} className={styles.payoutRow}>
                <span>{formatMoney(payout.amountCents, payout.currency)}</span>
                <span className={styles[`payoutStatus--${payout.status}`]}>
                  {NATIVE_AD_PAYOUT_STATUS_LABELS[payout.status]}
                </span>
                {payout.status === 'failed' && payout.failureReason && (
                  <span className={styles.hint}>{payout.failureReason}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className={styles.hint}>
        Реальный перевод денег выполняется администратором после проверки — обычно быстро, но не
        мгновенно.
      </p>
    </div>
  );
}
