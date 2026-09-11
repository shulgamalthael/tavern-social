'use client';

import { useState } from 'react';
import {
  approveAdCampaign,
  approveAdCreative,
  banAdvertiser,
  getAdvertisingOverview,
  rejectAdCampaign,
  rejectAdCreative,
  unbanAdvertiser,
  type AdminAdCampaign,
  type AdminAdCreative,
  type AdminAdvertiserBan,
} from '@/entities/admin';
import {
  AD_BILLING_MODEL_LABELS,
  AD_CAMPAIGN_STATUS_LABELS,
  AD_CREATIVE_STATUS_LABELS,
} from '@/entities/advertising';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { DailyBarChart } from './DailyBarChart';
import styles from './AdminAdvertisingPanel.module.scss';

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

interface CreativeRowProps {
  creative: AdminAdCreative;
  onDecided: () => void;
}

/** Тонкая модерация ПОВЕРХ модерации кампании (см. `AdCreativeStatus`'s
 * комментарий на backend) — снимает ОДИН креатив, не трогая статус самой
 * кампании и остальные её креативы. Доступно и на кампаниях в очереди
 * модерации (снять заведомо плохой креатив ДО одобрения всей кампании), и
 * на уже активных (снять найденный проблемным креатив без отзыва всей
 * кампании). */
function CreativeRow({ creative, onDecided }: CreativeRowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      if (creative.status === 'approved') {
        await rejectAdCreative(creative.id);
      } else {
        await approveAdCreative(creative.id);
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
      <span className={styles['creative-item__format']}>{creative.format}</span>
      <span className={styles['creative-item__headline']}>{creative.headline}</span>
      {creative.description && (
        <span className={styles['creative-item__description']}>{creative.description}</span>
      )}
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
          {AD_CREATIVE_STATUS_LABELS[creative.status]}
        </span>
        <Button variant="ghost" disabled={busy} onClick={handleToggle}>
          {creative.status === 'approved' ? 'Снять с показа' : 'Вернуть в показ'}
        </Button>
      </div>
      {error && <span className={styles['campaign-card__error']}>{error}</span>}
    </li>
  );
}

interface CampaignCardProps {
  campaign: AdminAdCampaign;
  /** `false` для уже активных кампаний — там approve/reject кампании
   * целиком больше не имеет смысла (см. `CreativeRow` для тонкой
   * модерации отдельных креативов уже активной кампании). */
  showCampaignDecision: boolean;
  onDecided: () => void;
}

/** Карточка одной кампании — approve/reject кампании целиком (только для
 * очереди модерации) + список креативов, каждый со своим независимым
 * reject/approve (см. `CreativeRow`) + бан рекламодателя прямо отсюда, раз
 * админ уже смотрит на конкретную проблемную кампанию. */
function CampaignCard({ campaign, showCampaignDecision, onDecided }: CampaignCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      await approveAdCampaign(campaign.id);
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
      await rejectAdCampaign(campaign.id, reason.trim() || undefined);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отклонить кампанию');
    } finally {
      setBusy(false);
    }
  }

  async function handleBan() {
    setBusy(true);
    setError(null);
    try {
      await banAdvertiser(campaign.advertiserBusinessId, banReason.trim() || undefined);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось забанить рекламодателя');
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
            {AD_BILLING_MODEL_LABELS[campaign.billingModel]} ·{' '}
            {formatMoney(campaign.bidCents, campaign.currency)} за{' '}
            {campaign.billingModel === 'cpm' ? '1000 показов' : 'клик'} · показов{' '}
            {campaign.impressionsServed} · кликов {campaign.clicksServed}
          </span>
        </div>
        <span className={cn(styles['status-badge'], styles[`status-badge--${campaign.status}`])}>
          {AD_CAMPAIGN_STATUS_LABELS[campaign.status]}
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
              <Button variant="outline" disabled={busy} onClick={handleReject}>
                Подтвердить отклонение
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setRejecting(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <>
              <Button variant="primary" disabled={busy} onClick={handleApprove}>
                Одобрить
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                Отклонить
              </Button>
            </>
          ))}

        {banning ? (
          <div className={styles['reject-form']}>
            <input
              className={styles['reject-form__input']}
              placeholder="Причина бана (необязательно)"
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              aria-label="Причина бана рекламодателя"
            />
            <Button variant="outline" disabled={busy} onClick={handleBan}>
              Подтвердить бан рекламодателя
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setBanning(false)}>
              Отмена
            </Button>
          </div>
        ) : (
          <Button variant="ghost" disabled={busy} onClick={() => setBanning(true)}>
            Забанить рекламодателя
          </Button>
        )}
      </div>
      {error && <span className={styles['campaign-card__error']}>{error}</span>}
    </Card>
  );
}

interface BannedAdvertiserRowProps {
  ban: AdminAdvertiserBan;
  onDecided: () => void;
}

function BannedAdvertiserRow({ ban, onDecided }: BannedAdvertiserRowProps) {
  const [busy, setBusy] = useState(false);

  async function handleUnban() {
    setBusy(true);
    try {
      await unbanAdvertiser(ban.businessId);
      onDecided();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={styles['inventory-item']}>
      <span className={styles['inventory-item__name']}>{ban.businessName}</span>
      <span className={styles['inventory-item__slots']}>{ban.reason ?? 'Без причины'}</span>
      <Button variant="ghost" disabled={busy} onClick={handleUnban}>
        Снять бан
      </Button>
    </li>
  );
}

/**
 * Admin Advertising Dashboard (AI_PLATFORM_ROADMAP.md §68/§68.4/§68.7) — один
 * составной экран поверх `GET /admin/advertising/overview`, тот же принцип,
 * что `AdminAiInfrastructurePanel` (см. её комментарий на backend про то,
 * почему один составной эндпоинт, а не десяток разрозненных).
 */
export function AdminAdvertisingPanel() {
  const { status, data, error, refetch } = useAsyncData(getAdvertisingOverview);

  if (status === 'loading') return <Loader label="Считаем рекламный инвентарь…" />;
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

      <div className={styles.grid}>
        <Card>
          <DailyBarChart
            title="Показы за 30 дней"
            points={data.dailyStats.map((point) => ({
              date: point.date,
              count: point.impressions,
            }))}
          />
        </Card>
        <Card>
          <DailyBarChart
            title="Клики за 30 дней"
            points={data.dailyStats.map((point) => ({ date: point.date, count: point.clicks }))}
          />
        </Card>
      </div>

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

      <Card>
        <h3 className={styles['section-title']}>Забаненные рекламодатели</h3>
        {data.bannedAdvertisers.length === 0 ? (
          <EmptyState
            title="Забаненных рекламодателей нет"
            description="Забанить можно прямо из карточки кампании выше."
          />
        ) : (
          <ul className={styles['inventory-list']}>
            {data.bannedAdvertisers.map((ban) => (
              <BannedAdvertiserRow key={ban.businessId} ban={ban} onDecided={refetch} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className={styles['section-title']}>Рекламный инвентарь по бизнесам</h3>
        {data.businesses.length === 0 ? (
          <EmptyState
            title="Ни у одного бизнеса пока нет подписки"
            description="Слоты становятся доступны только на платных тарифах."
          />
        ) : (
          <ul className={styles['inventory-list']}>
            {data.businesses.map((business) => (
              <li key={business.businessId} className={styles['inventory-item']}>
                <span className={styles['inventory-item__name']}>{business.businessName}</span>
                <span className={styles['inventory-item__tier']}>{business.tier ?? 'free'}</span>
                <span className={styles['inventory-item__slots']}>
                  {business.slotsOccupied}/{business.slotLimit} слотов занято (
                  {business.slotsAvailable} доступно)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
