'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PLAN_CATALOG,
  getBillingStatus,
  getPlanHistory,
  recordEnterpriseInquiry,
  selectPlan,
  type PlanTier,
  type SelectablePlanTier,
} from '@/entities/subscription';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { GrowthComparisonTable } from './GrowthComparisonTable';
import { PlanCard } from './PlanCard';
import { PlanHistoryList } from './PlanHistoryList';
import styles from './PlanSelectorWidget.module.scss';

export interface PlanSelectorWidgetProps {
  businessId: string;
  /** `?template=<id>` из AI-онбординга (AI-4) — переживает переход через
   * гейт и долетает до билдера в исходном виде (см. `WebsiteBuilderWidget`,
   * который сам читает его из `window.location.search`). */
  redirectTemplate?: string;
  /** `?checkout=success|cancel`, выставленные `success_url`/`cancel_url`
   * Stripe Checkout Session (см. `BillingService.startCheckout`). */
  initialCheckoutState?: 'success' | 'cancel';
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20_000;

/** Экран выбора тарифа (Payment Plans v1) — единственный путь в конструктор
 * для обоих сценариев создания бизнеса (см. `CreateBusinessForm`/
 * `NewBusinessFlow`), а после первого раза ещё и самостоятельная страница
 * апгрейда (ссылка "Текущий план" в `OverviewSection`). Жёсткий гейт живёт
 * на сервере (`app/(protected)/business/[id]/edit/page.tsx`), не здесь —
 * этот компонент только собирает выбор владельца и вызывает `BillingService`.
 */
export function PlanSelectorWidget({
  businessId,
  redirectTemplate,
  initialCheckoutState,
}: PlanSelectorWidgetProps) {
  const router = useRouter();
  const editUrl = `/business/${businessId}/edit${
    redirectTemplate ? `?template=${encodeURIComponent(redirectTemplate)}` : ''
  }`;

  const statusFetcher = useCallback(() => getBillingStatus(businessId), [businessId]);
  const billingStatus = useAsyncData(statusFetcher);
  const historyFetcher = useCallback(() => getPlanHistory(businessId), [businessId]);
  const history = useAsyncData(historyFetcher);

  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [switchSuccessMessage, setSwitchSuccessMessage] = useState<string | null>(null);
  const [enterpriseInquirySent, setEnterpriseInquirySent] = useState(false);

  const [isConfirmingPayment, setConfirmingPayment] = useState(initialCheckoutState === 'success');
  const [confirmTimedOut, setConfirmTimedOut] = useState(false);
  const pollStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isConfirmingPayment) return;

    pollStartedAtRef.current = Date.now();
    let cancelled = false;

    async function poll(): Promise<void> {
      const result = await getBillingStatus(businessId).catch(() => null);
      if (cancelled) return;

      if (result?.isGateOpen) {
        router.push(editUrl);
        return;
      }

      const elapsed = Date.now() - (pollStartedAtRef.current ?? Date.now());
      if (elapsed >= POLL_TIMEOUT_MS) {
        setConfirmTimedOut(true);
        return;
      }

      timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    }

    let timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [businessId, editUrl, isConfirmingPayment, router]);

  async function handleRetryConfirm() {
    setConfirmTimedOut(false);
    setConfirmingPayment(true);
  }

  // Тариф уже был выбран (свободный или платный) ДО этого действия — значит
  // это самостоятельная смена тарифа (владелец уже пользуется билдером), а
  // не первичный гейт после создания бизнеса. В этом случае после успеха
  // остаёмся на `/plan` с сообщением, а не уводим в билдер — тот же принцип,
  // что и различие "первый выбор" / "апгрейд" в implementation plan.
  const wasGateOpenBeforeAction = billingStatus.data?.isGateOpen ?? false;

  async function handleSelectPlan(tier: SelectablePlanTier) {
    setLoadingTier(tier);
    setActionError(null);
    setSwitchSuccessMessage(null);
    try {
      const { checkoutUrl } = await selectPlan(businessId, tier);
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }

      if (wasGateOpenBeforeAction) {
        const planName = PLAN_CATALOG.find((entry) => entry.tier === tier)?.name ?? tier;
        setSwitchSuccessMessage(`Готово — текущий тариф: ${planName}.`);
        billingStatus.refetch();
        history.refetch();
        setLoadingTier(null);
      } else {
        router.push(editUrl);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось сменить тариф');
      setLoadingTier(null);
    }
  }

  async function handleEnterpriseInquiry() {
    setLoadingTier('enterprise');
    setActionError(null);
    try {
      await recordEnterpriseInquiry(businessId);
      setEnterpriseInquirySent(true);
      history.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось отправить заявку');
    } finally {
      setLoadingTier(null);
    }
  }

  function handleSelect(tier: PlanTier) {
    if (tier === 'enterprise') return void handleEnterpriseInquiry();
    return void handleSelectPlan(tier);
  }

  if (isConfirmingPayment) {
    return (
      <div className={styles.confirming}>
        {confirmTimedOut ? (
          <>
            <p className={styles.confirming__title}>Подтверждение оплаты задерживается</p>
            <p className={styles.confirming__hint}>
              Обычно это занимает несколько секунд. Если оплата прошла, попробуйте проверить ещё раз
              — статус обновится, как только Stripe пришлёт подтверждение.
            </p>
            <button
              type="button"
              className={styles.confirming__retry}
              onClick={() => void handleRetryConfirm()}
            >
              Проверить ещё раз
            </button>
          </>
        ) : (
          <>
            <Loader label="Подтверждаем оплату…" />
            <p className={styles.confirming__hint}>Это займёт несколько секунд</p>
          </>
        )}
      </div>
    );
  }

  // `incomplete` — чекаут этого тира уже начат, но не завершён (см.
  // `BillingStatus.isGateOpen`): не считаем его "текущим", чтобы кнопка
  // осталась активной и владелец мог попробовать оплату ещё раз.
  const currentTier =
    billingStatus.data?.status !== 'incomplete' ? (billingStatus.data?.tier ?? null) : null;
  const hasPaidSubscription = currentTier !== null && currentTier !== 'free';

  return (
    <div className={styles.root}>
      <PageHead
        title="Выберите тариф"
        description="Бесплатный тариф открывает полноценный конструктор — платная подписка добавляет ресурсы и возможности сверху. Тариф можно сменить в любой момент."
      />

      {initialCheckoutState === 'cancel' && (
        <p className={styles.notice}>Оплата отменена — можно выбрать тариф снова в любой момент.</p>
      )}
      {switchSuccessMessage && <p className={styles.notice}>{switchSuccessMessage}</p>}
      {actionError && (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      )}

      <div className={styles.grid}>
        {PLAN_CATALOG.map((config) => (
          <PlanCard
            key={config.tier}
            config={config}
            isCurrent={currentTier === config.tier}
            isSwitch={hasPaidSubscription && currentTier !== config.tier && !config.isEnterprise}
            isLoading={loadingTier === config.tier}
            disabled={loadingTier !== null}
            enterpriseInquirySent={Boolean(config.isEnterprise) && enterpriseInquirySent}
            onSelect={() => handleSelect(config.tier)}
          />
        ))}
      </div>

      <GrowthComparisonTable />

      <section className={styles.history}>
        <h2 className={styles.history__title}>История тарифа</h2>
        <PlanHistoryList history={history} />
      </section>
    </div>
  );
}
