import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import { getAiOperationDefinition } from './ai-operations.registry';
import { calculateCostMicros, type ModelPricingConfig } from './model-pricing.lib';
import { AI_LOG_EVENTS } from './ai-alerts.service';
import { AiAnomalyService } from './ai-anomaly.service';
import { AiCapacityService } from './ai-capacity.service';
import { percentOfSafetyLimit } from './ai-capacity.lib';
import type {
  AiUsageByBusiness,
  AiUsageByOperation,
  RecordAiRequestInput,
} from './ai-capacity.types';
import { GeminiQuotaService } from '../quota/gemini-quota.service';

const EFFICIENCY_KEY_PREFIX = 'ai:efficiency:';
const TOP_DIMENSIONS_WINDOW_DAYS = 7;
const TOP_DIMENSIONS_LIMIT = 5;

/**
 * "Централизованный request accounting" (§4-5, §37 brief'а) — единственное
 * место, которое пишет `AiRequestLog` и обновляет производные Redis-счётчики
 * (TPM, efficiency). Вызывается ИЗ `AiGatewayService` (не из `GeminiAdapter` —
 * тот остаётся тонким "поговорить с Gemini", как и в прошлой итерации) после
 * каждой РЕАЛЬНОЙ попытки обращения к провайдеру, успешной или нет.
 */
@Injectable()
export class AiRequestAccountingService {
  private readonly logger = new Logger(AiRequestAccountingService.name);
  private readonly pricing: ModelPricingConfig | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly capacity: AiCapacityService,
    private readonly anomaly: AiAnomalyService,
    private readonly quota: GeminiQuotaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.pricing =
      config.geminiInputPricePerMillionUsd !== undefined &&
      config.geminiOutputPricePerMillionUsd !== undefined
        ? {
            model: config.geminiModel,
            inputPricePerMillionUsd: config.geminiInputPricePerMillionUsd,
            outputPricePerMillionUsd: config.geminiOutputPricePerMillionUsd,
          }
        : undefined;

    if (!this.pricing) {
      this.logger.warn(
        'GEMINI_INPUT_PRICE_PER_MILLION_USD/GEMINI_OUTPUT_PRICE_PER_MILLION_USD не заданы — стоимость AI-запросов не будет считаться (останется null в телеметрии)',
      );
    }
  }

  async recordRequest(input: RecordAiRequestInput): Promise<void> {
    const {
      operation,
      businessId,
      actorId,
      model,
      status,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
      errorMessage,
    } = input;
    const priority = getAiOperationDefinition(operation).priority;
    const costMicros =
      totalTokens !== undefined
        ? calculateCostMicros(this.pricing, inputTokens ?? 0, outputTokens ?? 0)
        : null;

    const quotaSnapshot = await this.quota.getSnapshot();
    const rpmUsedPercent = percentOfSafetyLimit(
      quotaSnapshot.rpm.used,
      quotaSnapshot.rpm.safetyLimit,
    );
    const rpdUsedPercent = percentOfSafetyLimit(
      quotaSnapshot.rpd.used,
      quotaSnapshot.rpd.safetyLimit,
    );

    await this.prisma.aiRequestLog.create({
      data: {
        operation,
        priority,
        businessId: businessId ?? null,
        actorId: actorId ?? null,
        model,
        status,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        totalTokens: totalTokens ?? null,
        costMicros,
        latencyMs: latencyMs ?? null,
        rpmUsedPercent,
        rpdUsedPercent,
        errorMessage: errorMessage ?? null,
      },
    });

    if (totalTokens) await this.capacity.bumpTpm(totalTokens);

    const eventName =
      status === 'success'
        ? AI_LOG_EVENTS.REQUEST_COMPLETED
        : status === 'rate_limited'
          ? AI_LOG_EVENTS.REQUEST_429
          : AI_LOG_EVENTS.REQUEST_FAILED;
    this.logger.log(
      `[${eventName}] [${operation}] status=${status} tokens=${totalTokens ?? 'n/a'} costMicros=${costMicros ?? 'n/a'} latencyMs=${latencyMs ?? 'n/a'}`,
    );

    const capacityStatus = this.capacity.statusFromPercents(rpmUsedPercent, rpdUsedPercent);
    await this.capacity.raiseAlertIfNeeded(capacityStatus, rpmUsedPercent, rpdUsedPercent);

    await this.anomaly.recordActorActivityAndCheck(actorId, operation);
    if (status === 'rate_limited') await this.anomaly.checkRetrySpike(operation, businessId);
  }

  async recordCacheHit(operation: string): Promise<void> {
    await this.bumpEfficiencyCounter('cached');
    this.logger.log(`[${AI_LOG_EVENTS.REQUEST_CACHED}] [${operation}]`);
  }

  async recordDedupHit(operation: string): Promise<void> {
    await this.bumpEfficiencyCounter('deduplicated');
    this.logger.log(`[${AI_LOG_EVENTS.REQUEST_DEDUPLICATED}] [${operation}]`);
  }

  /** Снимок для AI Efficiency Score (§20 brief'а) — реальные счётчики, не
   * оценка: `cached`/`deduplicated` из Redis (см. `bumpEfficiencyCounter`),
   * `realRequests` — COUNT из `AiRequestLog` за то же окно, что и
   * ретеншен сырых логов (дальше него всё равно не сравнить). */
  async getEfficiencySnapshot(): Promise<{
    cached: number;
    deduplicated: number;
    realRequests: number;
  }> {
    const [cachedRaw, dedupRaw, realRequests] = await Promise.all([
      this.redis.get(`${EFFICIENCY_KEY_PREFIX}cached`),
      this.redis.get(`${EFFICIENCY_KEY_PREFIX}deduplicated`),
      this.prisma.aiRequestLog.count(),
    ]);
    return { cached: Number(cachedRaw ?? 0), deduplicated: Number(dedupRaw ?? 0), realRequests };
  }

  async getTopOperations(): Promise<AiUsageByOperation[]> {
    const since = new Date(Date.now() - TOP_DIMENSIONS_WINDOW_DAYS * 86_400_000);
    const rows = await this.prisma.aiRequestLog.groupBy({
      by: ['operation'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, costMicros: true },
      orderBy: { _count: { operation: 'desc' } },
      take: TOP_DIMENSIONS_LIMIT,
    });
    return rows.map((row) => ({
      operation: row.operation,
      requestCount: row._count._all,
      totalTokens: row._sum.totalTokens ?? 0,
      costMicros: row._sum.costMicros ?? 0,
    }));
  }

  async getTopBusinesses(): Promise<AiUsageByBusiness[]> {
    const since = new Date(Date.now() - TOP_DIMENSIONS_WINDOW_DAYS * 86_400_000);
    const rows = await this.prisma.aiRequestLog.groupBy({
      by: ['businessId'],
      where: { createdAt: { gte: since }, businessId: { not: null } },
      _count: { _all: true },
      _sum: { totalTokens: true, costMicros: true },
      orderBy: { _count: { businessId: 'desc' } },
      take: TOP_DIMENSIONS_LIMIT,
    });
    return rows
      .filter((row): row is typeof row & { businessId: string } => row.businessId !== null)
      .map((row) => ({
        businessId: row.businessId,
        requestCount: row._count._all,
        totalTokens: row._sum.totalTokens ?? 0,
        costMicros: row._sum.costMicros ?? 0,
      }));
  }

  async getCostSummary(): Promise<{
    todayCostMicros: number;
    monthCostMicros: number;
    todayRequestCount: number;
    monthRequestCount: number;
  }> {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [todayAgg, monthRawAgg, monthDailyAgg] = await Promise.all([
      this.prisma.aiRequestLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { costMicros: true },
        _count: { _all: true },
      }),
      this.prisma.aiRequestLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { costMicros: true },
        _count: { _all: true },
      }),
      this.prisma.aiUsageDailyAggregate.aggregate({
        where: { date: { gte: monthStart, lt: todayStart } },
        _sum: { costMicros: true, requestCount: true },
      }),
    ]);

    return {
      todayCostMicros: todayAgg._sum.costMicros ?? 0,
      todayRequestCount: todayAgg._count._all,
      monthCostMicros: (monthDailyAgg._sum.costMicros ?? 0) + (monthRawAgg._sum.costMicros ?? 0),
      monthRequestCount: (monthDailyAgg._sum.requestCount ?? 0) + monthRawAgg._count._all,
    };
  }

  private async bumpEfficiencyCounter(name: 'cached' | 'deduplicated'): Promise<void> {
    try {
      await this.redis.incr(`${EFFICIENCY_KEY_PREFIX}${name}`);
    } catch (error) {
      this.logger.warn(
        `Не удалось обновить efficiency-счётчик ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
