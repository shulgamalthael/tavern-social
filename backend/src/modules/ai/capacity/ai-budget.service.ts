import { Injectable } from '@nestjs/common';
import type { AiBudgetScope } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { centsToMicros } from './model-pricing.lib';
import { AI_LOG_EVENTS, AiAlertsService } from './ai-alerts.service';
import { shouldAdmit, type AiPriorityLevel } from './ai-capacity.lib';
import type { AiBudgetStatusDto } from './ai-capacity.types';

/** При достижении soft/hard-порога бюджета не льём алерт на каждый запрос —
 * тот же приём дедупликации, что у capacity-алертов (`AiAlertsService`
 * дедуплицирует их сама по `type`, здесь просто нужен СТАБИЛЬНЫЙ `type` на
 * скоуп бюджета, не на каждый вызов) — префикс `AI_LOG_EVENTS.BUDGET_*`
 * держит имя события согласованным с §37 brief'а, суффикс делает его
 * уникальным per-scope. */
function budgetAlertType(event: string, scope: AiBudgetScope, businessId: string | null): string {
  return `${event}:${scope}:${businessId ?? 'global'}`;
}

/** Soft-лимит — предупреждение при достижении этой доли бюджета; выше него
 * (100%) — hard-лимит, режущий non-essential (не `high`) операции (§17
 * brief'а). Не вынесено в `.env` — единственное разумное значение "начать
 * предупреждать заранее", не отдельная бизнес-политика на конфигурацию. */
const SOFT_LIMIT_PERCENT = 80;

/**
 * Cost Budgets (§17 brief'а) — GLOBAL (ровно одна запись,
 * `businessId=null`) и BUSINESS (по бизнесу). USER/SUBSCRIPTION-бюджеты (§18
 * "тарифы Business OS") сознательно не реализованы в этой итерации — нет
 * модели подписки/тарифа в схеме, привязывать бюджет было бы не к чему
 * (согласовано с пользователем перед реализацией, см. диалог).
 *
 * Расход месяца считается из `AiUsageDailyAggregate` (полные ЗАВЕРШЁННЫЕ дни,
 * см. `AiRetentionService`'s комментарий про то, что агрегация никогда не
 * трогает сегодняшний день) + сырых `AiRequestLog` за СЕГОДНЯ — без двойного
 * счёта, всегда актуально, даже если фоновая агрегация ещё не прошла за
 * сегодня.
 */
@Injectable()
export class AiBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AiAlertsService,
  ) {}

  async setBudget(
    scope: AiBudgetScope,
    businessId: string | null,
    monthlyLimitCents: number,
  ): Promise<void> {
    await this.prisma.aiBudget.upsert({
      where: { scope_businessId: { scope, businessId: businessId ?? '' } },
      // `businessId ?? ''` в `where` — Prisma composite unique не матчит
      // `null` через обычное сравнение равенства так же, как SQL `IS NULL`;
      // `''` невозможен как реальный `businessId` (UUID), безопасный
      // sentinel для "нет бизнеса" именно в контексте этого unique-индекса.
      create: { scope, businessId, monthlyLimitCents },
      update: { monthlyLimitCents },
    });
  }

  async getMonthSpendMicros(scope: AiBudgetScope, businessId: string | null): Promise<number> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const businessFilter = scope === 'business' ? { businessId } : {};

    const [aggregateSum, todayRawSum] = await Promise.all([
      this.prisma.aiUsageDailyAggregate.aggregate({
        where: { date: { gte: monthStart, lt: todayStart }, ...businessFilter },
        _sum: { costMicros: true },
      }),
      this.prisma.aiRequestLog.aggregate({
        where: { createdAt: { gte: todayStart }, ...businessFilter },
        _sum: { costMicros: true },
      }),
    ]);

    return (aggregateSum._sum.costMicros ?? 0) + (todayRawSum._sum.costMicros ?? 0);
  }

  async getBudgetStatuses(): Promise<AiBudgetStatusDto[]> {
    const budgets = await this.prisma.aiBudget.findMany();
    return Promise.all(
      budgets.map(async (budget) => {
        const spentMicros = await this.getMonthSpendMicros(budget.scope, budget.businessId);
        const limitMicros = centsToMicros(budget.monthlyLimitCents);
        return {
          scope: budget.scope,
          businessId: budget.businessId,
          monthlyLimitCents: budget.monthlyLimitCents,
          spentMicros,
          remainingMicros: Math.max(0, limitMicros - spentMicros),
          spentPercent: limitMicros > 0 ? Math.round((spentMicros / limitMicros) * 100) : 0,
        };
      }),
    );
  }

  /** Проверяет global-бюджет (если настроен) и, если передан `businessId`,
   * ещё и business-бюджет — блокирует, если ЛЮБОЙ из них превышен И
   * приоритет запроса не `high` (см. `shouldAdmit`: hard-limit ведёт себя как
   * искусственный `critical`-статус capacity именно для затронутого скоупа,
   * не понижает admission ниже этого для всей системы). Не настроенный
   * бюджет (нет строки в БД) — не ограничивает вообще, соответствует
   * "soft/hard limit опциональны" из §17. */
  async checkBudgetAdmission(
    priority: AiPriorityLevel,
    businessId: string | undefined,
  ): Promise<{ admitted: boolean; exceededScope?: AiBudgetScope }> {
    const scopesToCheck: { scope: AiBudgetScope; businessId: string | null }[] = [
      { scope: 'global', businessId: null },
      ...(businessId ? [{ scope: 'business' as const, businessId }] : []),
    ];

    for (const { scope, businessId: scopeBusinessId } of scopesToCheck) {
      const budget = await this.prisma.aiBudget.findUnique({
        where: { scope_businessId: { scope, businessId: scopeBusinessId ?? '' } },
      });
      if (!budget) continue;

      const spentMicros = await this.getMonthSpendMicros(scope, scopeBusinessId);
      const limitMicros = centsToMicros(budget.monthlyLimitCents);
      const spentPercent = limitMicros > 0 ? Math.round((spentMicros / limitMicros) * 100) : 0;

      if (spentPercent >= 100) {
        await this.alerts.raise(
          budgetAlertType(AI_LOG_EVENTS.BUDGET_EXCEEDED, scope, scopeBusinessId),
          'critical',
          `Бюджет ${scope}${scopeBusinessId ? ` (${scopeBusinessId})` : ''} исчерпан: ${spentPercent}%`,
          { spentMicros, limitMicros },
        );
        if (!shouldAdmit(priority, 'critical')) return { admitted: false, exceededScope: scope };
      } else if (spentPercent >= SOFT_LIMIT_PERCENT) {
        await this.alerts.raise(
          budgetAlertType(AI_LOG_EVENTS.BUDGET_WARNING, scope, scopeBusinessId),
          'warning',
          `Бюджет ${scope}${scopeBusinessId ? ` (${scopeBusinessId})` : ''} на ${spentPercent}% от лимита`,
          { spentMicros, limitMicros },
        );
      }
    }

    return { admitted: true };
  }
}
