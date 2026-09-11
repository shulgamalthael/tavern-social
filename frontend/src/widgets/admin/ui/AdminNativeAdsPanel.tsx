'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  approveNativeAdCampaign,
  approveNativeAdCreative,
  assignCreatorToNativeAd,
  getNativeAdsOverview,
  listEligibleCreators,
  listNativeAdAssignments,
  listRecommendedCreators,
  rejectNativeAdCampaign,
  rejectNativeAdCreative,
  unassignCreatorFromNativeAd,
  type AdminNativeAdCampaign,
  type AdminNativeAdCreative,
  type EligibleCreator,
  type NativeAdAssignment,
  type RecommendedCreator,
} from '@/entities/admin';
import {
  NATIVE_AD_CAMPAIGN_STATUS_LABELS,
  NATIVE_AD_CREATIVE_STATUS_LABELS,
} from '@/entities/native-ad';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { AdminNativeAdPayoutsPanel } from './AdminNativeAdPayoutsPanel';
import { AdminNativeAdRevenueSettings } from './AdminNativeAdRevenueSettings';
import styles from './AdminAdvertisingPanel.module.scss';

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

interface CreativeRowProps {
  creative: AdminNativeAdCreative;
  onDecided: () => void;
}

function CreativeRow({ creative, onDecided }: CreativeRowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      if (creative.status === 'approved') {
        await rejectNativeAdCreative(creative.id);
      } else {
        await approveNativeAdCreative(creative.id);
      }
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус креатива');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={styles['creative-item']}>
      <span className={styles['creative-item__format']}>{creative.style}</span>
      <span className={styles['creative-item__headline']}>{creative.headline}</span>
      <a
        href={creative.targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles['creative-item__link']}
      >
        {creative.targetUrl}
      </a>
      <div className={styles['creative-item__footer']}>
        <span
          className={cn(styles['creative-status'], styles[`creative-status--${creative.status}`])}
        >
          {NATIVE_AD_CREATIVE_STATUS_LABELS[creative.status]}
        </span>
        <Button variant="ghost" disabled={busy} onClick={() => void handleToggle()}>
          {creative.status === 'approved' ? 'Снять с показа' : 'Вернуть в показ'}
        </Button>
      </div>
      {error && <span className={styles['campaign-card__error']}>{error}</span>}
    </li>
  );
}

interface AssignmentManagerProps {
  campaignId: string;
}

/** Ручное назначение creator'ов (Phase 2 — "no AI yet") — только для активных
 * кампаний, см. `AdminNativeAdsPanel`'s комментарий. */
function AssignmentManager({ campaignId }: AssignmentManagerProps) {
  const [assignments, setAssignments] = useState<NativeAdAssignment[] | null>(null);
  const [eligible, setEligible] = useState<EligibleCreator[] | null>(null);
  const [recommended, setRecommended] = useState<RecommendedCreator[] | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [assignmentList, eligibleList, recommendedList] = await Promise.all([
      listNativeAdAssignments(campaignId),
      listEligibleCreators(),
      listRecommendedCreators(campaignId),
    ]);
    setAssignments(assignmentList);
    setEligible(eligibleList);
    setRecommended(recommendedList);
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listNativeAdAssignments(campaignId),
      listEligibleCreators(),
      listRecommendedCreators(campaignId),
    ]).then(([assignmentList, eligibleList, recommendedList]) => {
      if (cancelled) return;
      setAssignments(assignmentList);
      setEligible(eligibleList);
      setRecommended(recommendedList);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function handleAssign(creatorProfileId: string) {
    if (!creatorProfileId) return;
    setBusy(true);
    setError(null);
    try {
      await assignCreatorToNativeAd(campaignId, creatorProfileId);
      setSelectedCreatorId('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось назначить creator’а');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign(creatorProfileId: string) {
    setBusy(true);
    setError(null);
    try {
      await unassignCreatorFromNativeAd(campaignId, creatorProfileId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось снять назначение');
    } finally {
      setBusy(false);
    }
  }

  if (!assignments || !eligible || !recommended) return <Loader label="Загружаем назначения…" />;

  const assignedIds = new Set(assignments.map((assignment) => assignment.creatorProfileId));
  const availableCreators = eligible.filter(
    (creator) => !assignedIds.has(creator.creatorProfileId),
  );
  const availableRecommended = recommended.filter(
    (creator) => !assignedIds.has(creator.creatorProfileId),
  );

  return (
    <div className={styles['inventory-list']}>
      {assignments.length === 0 ? (
        <EmptyState title="Кампания пока никому не назначена" />
      ) : (
        <ul className={styles['inventory-list']}>
          {assignments.map((assignment) => (
            <li key={assignment.id} className={styles['inventory-item']}>
              <span className={styles['inventory-item__name']}>{assignment.creatorName}</span>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void handleUnassign(assignment.creatorProfileId)}
              >
                Снять назначение
              </Button>
            </li>
          ))}
        </ul>
      )}

      {availableRecommended.length > 0 && (
        <div className={styles['inventory-list']}>
          <span className={styles['campaign-card__name']}>Рекомендовано</span>
          <ul className={styles['inventory-list']}>
            {availableRecommended.map((creator) => (
              <li key={creator.creatorProfileId} className={styles['inventory-item']}>
                <span className={styles['inventory-item__name']}>
                  {creator.name} · {creator.matchPercent}%
                </span>
                <span className={styles['inventory-item__slots']}>
                  {creator.reasons.join(' · ')}
                </span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleAssign(creator.creatorProfileId)}
                >
                  Назначить
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {availableCreators.length > 0 && (
        <div className={styles['reject-form']}>
          <select
            className={styles['reject-form__input']}
            value={selectedCreatorId}
            onChange={(event) => setSelectedCreatorId(event.target.value)}
            aria-label="Выбрать creator'а для назначения"
          >
            <option value="">Выберите creator&rsquo;а…</option>
            {availableCreators.map((creator) => (
              <option key={creator.creatorProfileId} value={creator.creatorProfileId}>
                {creator.name}
                {creator.primaryCategory ? ` · ${creator.primaryCategory}` : ''}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={busy || !selectedCreatorId}
            onClick={() => void handleAssign(selectedCreatorId)}
          >
            Назначить
          </Button>
        </div>
      )}
      {error && <span className={styles['campaign-card__error']}>{error}</span>}
    </div>
  );
}

interface CampaignCardProps {
  campaign: AdminNativeAdCampaign;
  showCampaignDecision: boolean;
  onDecided: () => void;
}

function CampaignCard({ campaign, showCampaignDecision, onDecided }: CampaignCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      await approveNativeAdCampaign(campaign.id);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось одобрить кампанию');
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      await rejectNativeAdCampaign(campaign.id, reason.trim() || undefined);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отклонить кампанию');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={styles['campaign-card']}>
      <div className={styles['campaign-card__header']}>
        <div>
          <h4 className={styles['campaign-card__name']}>{campaign.name}</h4>
          <span className={styles['campaign-card__meta']}>
            Бизнес {campaign.advertiserBusinessId} · потрачено{' '}
            {formatMoney(campaign.spentCents, campaign.currency)} /{' '}
            {formatMoney(campaign.budgetCents, campaign.currency)} · оплата:{' '}
            {campaign.paymentStatus === 'paid' ? 'оплачено' : campaign.paymentStatus}
          </span>
          <span className={styles['campaign-card__meta']}>
            показов {campaign.impressionsServed} · кликов {campaign.clicksServed}
            {campaign.adCategory ? ` · категория: ${campaign.adCategory}` : ''}
          </span>
        </div>
        <span className={cn(styles['status-badge'], styles[`status-badge--${campaign.status}`])}>
          {NATIVE_AD_CAMPAIGN_STATUS_LABELS[campaign.status]}
        </span>
      </div>

      {campaign.creatives.length === 0 ? (
        <EmptyState title="У кампании нет ни одного креатива" />
      ) : (
        <ul className={styles['creative-list']}>
          {campaign.creatives.map((creative) => (
            <CreativeRow key={creative.id} creative={creative} onDecided={onDecided} />
          ))}
        </ul>
      )}

      {!showCampaignDecision && campaign.status === 'active' && (
        <AssignmentManager campaignId={campaign.id} />
      )}

      <div className={styles['campaign-card__actions']}>
        {showCampaignDecision &&
          (campaign.paymentStatus !== 'paid' ? (
            <span className={styles['campaign-card__hint']}>
              Ожидает оплаты — одобрение недоступно, пока платёж не подтверждён вебхуком Stripe.
            </span>
          ) : rejecting ? (
            <div className={styles['reject-form']}>
              <input
                className={styles['reject-form__input']}
                placeholder="Причина отклонения (необязательно)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-label="Причина отклонения"
              />
              <Button variant="outline" disabled={busy} onClick={() => void handleReject()}>
                Подтвердить отклонение
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <>
              <Button variant="primary" disabled={busy} onClick={() => void handleApprove()}>
                Одобрить
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                Отклонить
              </Button>
            </>
          ))}
      </div>
      {error && <span className={styles['campaign-card__error']}>{error}</span>}
    </Card>
  );
}

/**
 * Admin Native Ads (Creator Monetization Phase 2, AI_PLATFORM_ROADMAP.md
 * §80) — тот же принцип, что `AdminAdvertisingPanel` (переиспользует её
 * SCSS-модуль напрямую, форма записей идентична), плюс ручное назначение
 * creator'ов на активную кампанию (`AssignmentManager`) — которого у
 * сайтовой рекламы нет вообще (там показ решает `AdEngineService`
 * автоматически по таргетингу).
 */
export function AdminNativeAdsPanel() {
  const { status, data, error, refetch } = useAsyncData(getNativeAdsOverview);

  if (status === 'loading') return <Loader label="Считаем рекламу в ленте…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.grid}>
        <Card className={styles.tile}>
          <span className={styles['tile__value']}>{data.totals.impressions}</span>
          <span className={styles['tile__label']}>Показов</span>
        </Card>
        <Card className={styles.tile}>
          <span className={styles['tile__value']}>{data.totals.clicks}</span>
          <span className={styles['tile__label']}>Кликов</span>
        </Card>
        <Card className={styles.tile}>
          <span className={styles['tile__value']}>{formatPercent(data.totals.ctr)}</span>
          <span className={styles['tile__label']}>CTR</span>
        </Card>
        <Card className={styles.tile}>
          {Object.keys(data.totals.revenueByCurrency).length === 0 ? (
            <span className={styles['tile__value']}>{formatMoney(0, 'USD')}</span>
          ) : (
            <span className={styles['tile__value']}>
              {Object.entries(data.totals.revenueByCurrency)
                .map(([currency, cents]) => formatMoney(cents, currency))
                .join(' + ')}
            </span>
          )}
          <span className={styles['tile__label']}>Выручка (оплаченные кампании, по валютам)</span>
        </Card>
      </div>

      {Object.keys(data.totals.realizedRevenueByCurrency).length > 0 && (
        <Card>
          <h3 className={styles['section-title']}>Реализованная выручка (по показам/кликам)</h3>
          <div className={styles.grid}>
            {Object.entries(data.totals.realizedRevenueByCurrency).map(([currency, split]) => (
              <Card key={currency} className={styles.tile}>
                <span className={styles['tile__value']}>
                  {formatMoney(
                    split.creatorShareCents + split.platformFeeCents + split.processingFeeCents,
                    currency,
                  )}
                </span>
                <span className={styles['tile__label']}>
                  Creator {formatMoney(split.creatorShareCents, currency)} · Платформа{' '}
                  {formatMoney(split.platformFeeCents, currency)} · Обработка{' '}
                  {formatMoney(split.processingFeeCents, currency)}
                </span>
              </Card>
            ))}
          </div>
        </Card>
      )}

      <AdminNativeAdRevenueSettings />

      <AdminNativeAdPayoutsPanel />

      <Card>
        <h3 className={styles['section-title']}>Кампании на модерации</h3>
        {data.pendingCampaigns.length === 0 ? (
          <EmptyState
            title="Очередь модерации пуста"
            description="Новые кампании появятся здесь после того, как рекламодатель оплатит бюджет."
          />
        ) : (
          <div className={styles['campaign-list']}>
            {data.pendingCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                showCampaignDecision
                onDecided={refetch}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className={styles['section-title']}>Активные кампании</h3>
        {data.activeCampaigns.length === 0 ? (
          <EmptyState title="Пока нет ни одной активной кампании" />
        ) : (
          <div className={styles['campaign-list']}>
            {data.activeCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                showCampaignDecision={false}
                onDecided={refetch}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className={styles['section-title']}>Приостановленные кампании</h3>
        {data.pausedCampaigns.length === 0 ? (
          <EmptyState
            title="Приостановленных кампаний нет"
            description="Кампания ставится на паузу автоматически при исчерпании бюджета."
          />
        ) : (
          <div className={styles['campaign-list']}>
            {data.pausedCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                showCampaignDecision={false}
                onDecided={refetch}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
