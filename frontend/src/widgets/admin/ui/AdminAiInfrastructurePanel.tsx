'use client';

import { useState } from 'react';
import {
  getAiInfrastructureOverview,
  recomputeAiRecommendations,
  setAiBudget,
  type AiCapacityStatus,
} from '@/entities/admin';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './AdminAiInfrastructurePanel.module.scss';

const STATUS_LABEL: Record<AiCapacityStatus, string> = {
  normal: 'Норма',
  warning: 'Внимание',
  critical: 'Критично',
  emergency: 'Аварийно',
};

function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface GaugeProps {
  label: string;
  used: number;
  limit: number;
  usedPercent: number;
}

/** Простая линейная шкала — не переиспользует `dataviz`-палитру доменного
 * бренда (RPM/RPD % — служебная метрика, не пользовательские данные),
 * трёхцветный порог (норма/внимание/критично) читается яснее одноцветного
 * градиента для "сколько % от лимита осталось". */
function Gauge({ label, used, limit, usedPercent }: GaugeProps) {
  const tone =
    usedPercent >= 95
      ? 'emergency'
      : usedPercent >= 85
        ? 'critical'
        : usedPercent >= 70
          ? 'warning'
          : 'normal';
  return (
    <div className={styles.gauge}>
      <div className={styles.gauge__header}>
        <span className={styles.gauge__label}>{label}</span>
        <span className={styles.gauge__value}>
          {used}/{limit} ({usedPercent}%)
        </span>
      </div>
      <div className={styles.gauge__track}>
        <div
          className={cn(styles.gauge__fill, styles[`gauge__fill--${tone}`])}
          style={{ width: `${Math.min(100, usedPercent)}%` }}
        />
      </div>
    </div>
  );
}

function BudgetForm({ onSaved }: { onSaved: () => void }) {
  const [scope, setScope] = useState<'global' | 'business'>('global');
  const [businessId, setBusinessId] = useState('');
  const [limitDollars, setLimitDollars] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const dollars = Number(limitDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Укажите положительную сумму в долларах');
      return;
    }
    if (scope === 'business' && businessId.trim().length === 0) {
      setError('Укажите businessId для бюджета бизнеса');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setAiBudget({
        scope,
        businessId: scope === 'business' ? businessId.trim() : undefined,
        monthlyLimitCents: Math.round(dollars * 100),
      });
      setLimitDollars('');
      setBusinessId('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить бюджет');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles['budget-form']} onSubmit={handleSubmit}>
      <select
        className={styles['budget-form__select']}
        value={scope}
        onChange={(event) => setScope(event.target.value as 'global' | 'business')}
        aria-label="Область бюджета"
      >
        <option value="global">Глобальный</option>
        <option value="business">Бизнес</option>
      </select>
      {scope === 'business' && (
        <input
          className={styles['budget-form__input']}
          placeholder="businessId"
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
          aria-label="ID бизнеса"
        />
      )}
      <input
        className={styles['budget-form__input']}
        placeholder="Лимит в месяц, $"
        inputMode="decimal"
        value={limitDollars}
        onChange={(event) => setLimitDollars(event.target.value)}
        aria-label="Месячный лимит в долларах"
      />
      <Button type="submit" variant="outline" disabled={saving}>
        {saving ? 'Сохраняем…' : 'Задать бюджет'}
      </Button>
      {error && <span className={styles['budget-form__error']}>{error}</span>}
    </form>
  );
}

/**
 * AI Infrastructure Dashboard (§30-32 GEMINI CAPACITY & COST MANAGER brief'а)
 * — один составной экран поверх `GET /admin/ai-infrastructure/overview`
 * (см. её комментарий на backend про то, почему не 10 отдельных разделов,
 * как в идеализированной раскладке brief'а).
 */
export function AdminAiInfrastructurePanel() {
  const { status, data, error, refetch } = useAsyncData(getAiInfrastructureOverview);
  const [recomputing, setRecomputing] = useState(false);

  async function handleRecompute() {
    setRecomputing(true);
    try {
      await recomputeAiRecommendations();
      refetch();
    } finally {
      setRecomputing(false);
    }
  }

  if (status === 'loading') return <Loader label="Считаем AI-нагрузку…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className={styles.panel}>
      <Card className={styles['status-card']}>
        <div className={styles['status-card__header']}>
          <span
            className={cn(styles['status-badge'], styles[`status-badge--${data.capacity.status}`])}
          >
            {STATUS_LABEL[data.capacity.status]}
          </span>
          <span className={styles['status-card__hint']}>
            Провайдер: Gemini. Автоматическое определение usage tier у Gemini недоступно (нет
            публичного API, в отличие от OpenAI) — показаны наши собственные сконфигурированные
            лимиты: RPM {data.tierInfo.currentLimits.rpm}, RPD {data.tierInfo.currentLimits.rpd}.
          </span>
        </div>
        <div className={styles.gauges}>
          <Gauge
            label="RPM"
            used={data.capacity.rpm.used}
            limit={data.capacity.rpm.safetyLimit}
            usedPercent={data.capacity.rpm.usedPercent}
          />
          <Gauge
            label="RPD"
            used={data.capacity.rpd.used}
            limit={data.capacity.rpd.safetyLimit}
            usedPercent={data.capacity.rpd.usedPercent}
          />
        </div>
        <p className={styles['tpm-line']}>
          TPM (текущая минута): {data.capacity.tpm.used} токенов — не ограничивается, только
          отслеживается.
        </p>
      </Card>

      <div className={styles.grid}>
        <Card>
          <h3 className={styles['section-title']}>Стоимость</h3>
          <div className={styles['cost-tiles']}>
            <div className={styles['cost-tile']}>
              <span className={styles['cost-tile__value']}>
                {formatUsd(data.cost.todayCostMicros)}
              </span>
              <span className={styles['cost-tile__label']}>
                Сегодня ({data.cost.todayRequestCount} запросов)
              </span>
            </div>
            <div className={styles['cost-tile']}>
              <span className={styles['cost-tile__value']}>
                {formatUsd(data.cost.monthCostMicros)}
              </span>
              <span className={styles['cost-tile__label']}>
                За месяц ({data.cost.monthRequestCount} запросов)
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className={styles['section-title']}>Прогноз capacity</h3>
          {!data.forecast.sufficientData ? (
            <EmptyState
              title="Недостаточно данных для прогноза"
              description="Нужно минимум несколько дней истории — прогноз честно не рисует тренд по единичным точкам."
            />
          ) : (
            <div className={styles.forecast}>
              <p>Средний рост: {data.forecast.averageDailyGrowthPercent}% в день</p>
              <p>Прогноз запросов через 30 дней: {data.forecast.projectedRequestsIn30Days}</p>
              <p>
                {data.forecast.daysUntilCapacityInsufficient === null
                  ? 'Текущей RPD-квоты хватит в обозримом горизонте.'
                  : `Текущей RPD-квоты может не хватить примерно через ${data.forecast.daysUntilCapacityInsufficient} дн.`}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className={styles['section-header']}>
          <h3 className={styles['section-title']}>Бюджеты</h3>
        </div>
        {data.budgets.length === 0 ? (
          <EmptyState
            title="Бюджеты не заданы"
            description="AI-расход не ограничен по бюджету — только по RPM/RPD Gemini."
          />
        ) : (
          <ul className={styles['budget-list']}>
            {data.budgets.map((budget) => (
              <li
                key={`${budget.scope}-${budget.businessId ?? 'global'}`}
                className={styles['budget-item']}
              >
                <span className={styles['budget-item__scope']}>
                  {budget.scope === 'global' ? 'Глобальный' : `Бизнес ${budget.businessId}`}
                </span>
                <span>
                  {formatUsd(budget.spentMicros)} / {formatCents(budget.monthlyLimitCents)} (
                  {budget.spentPercent}%)
                </span>
              </li>
            ))}
          </ul>
        )}
        <BudgetForm onSaved={refetch} />
      </Card>

      <div className={styles.grid}>
        <Card>
          <h3 className={styles['section-title']}>Топ операций (7 дн.)</h3>
          {data.topOperations.length === 0 ? (
            <EmptyState title="Пока нет запросов" />
          ) : (
            <ul className={styles['dimension-list']}>
              {data.topOperations.map((row) => (
                <li key={row.operation} className={styles['dimension-item']}>
                  <span>{row.operation}</span>
                  <span>
                    {row.requestCount} запр. · {row.totalTokens} ток. · {formatUsd(row.costMicros)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className={styles['section-title']}>Топ бизнесов (7 дн.)</h3>
          {data.topBusinesses.length === 0 ? (
            <EmptyState title="Пока нет запросов" />
          ) : (
            <ul className={styles['dimension-list']}>
              {data.topBusinesses.map((row) => (
                <li key={row.businessId} className={styles['dimension-item']}>
                  <span className={styles['dimension-item__id']}>{row.businessId}</span>
                  <span>
                    {row.requestCount} запр. · {row.totalTokens} ток. · {formatUsd(row.costMicros)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className={styles.grid}>
        <Card>
          <h3 className={styles['section-title']}>Последние алерты</h3>
          {data.recentAlerts.length === 0 ? (
            <EmptyState title="Алертов нет" />
          ) : (
            <ul className={styles['event-list']}>
              {data.recentAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className={cn(styles['event-item'], styles[`event-item--${alert.severity}`])}
                >
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className={styles['section-title']}>Аномалии</h3>
          {data.recentAnomalies.length === 0 ? (
            <EmptyState title="Аномалий не обнаружено" />
          ) : (
            <ul className={styles['event-list']}>
              {data.recentAnomalies.map((anomaly) => (
                <li key={anomaly.id} className={styles['event-item']}>
                  {anomaly.description}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className={styles['section-header']}>
          <h3 className={styles['section-title']}>Рекомендации</h3>
          <Button variant="ghost" onClick={handleRecompute} disabled={recomputing}>
            {recomputing ? 'Пересчитываем…' : 'Пересчитать сейчас'}
          </Button>
        </div>
        {data.recommendations.length === 0 ? (
          <EmptyState
            title="Рекомендаций пока нет"
            description="Появятся при достаточном объёме данных — не выдумываются на пустых метриках."
          />
        ) : (
          <ul className={styles['event-list']}>
            {data.recommendations.map((recommendation) => (
              <li key={recommendation.id} className={styles['event-item']}>
                {recommendation.message}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
