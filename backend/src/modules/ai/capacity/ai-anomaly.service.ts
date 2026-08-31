import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import { AI_LOG_EVENTS } from './ai-alerts.service';
import { isRateAnomaly } from './ai-capacity.lib';
import type { AiAnomalyDto } from './ai-capacity.types';

const ACTOR_ACTIVITY_KEY_PREFIX = 'ai:actor-activity:';
const ACTOR_ACTIVITY_KEY_TTL_SECONDS = 65;
const RECENT_ANOMALIES_LIMIT = 20;
const RETRY_SPIKE_WINDOW_MS = 5 * 60_000;
const COST_SPIKE_BASELINE_DAYS = 7;
/** Не пишем новую строку той же аномалии на каждый запрос, пока актёр
 * продолжает превышать порог — как только зафиксировано, пауза перед
 * следующей такой же записью. */
const ANOMALY_DEDUP_WINDOW_MS = 5 * 60_000;

/**
 * Anomaly Detection (§23 brief'а) — пороговое сравнение "текущее значение
 * против baseline/абсолютного порога" (`isRateAnomaly`), НЕ ML/статистика —
 * см. `AiAnomaly`'s комментарий в схеме про то же самое честное ограничение.
 *
 * Три проверки: (1) внезапный всплеск частоты запросов ОТ ОДНОГО actor'а —
 * честно используем `aiAnomalyRateMultiplier` как абсолютный порог, не
 * настоящий per-actor исторический baseline (его пришлось бы копить неделями
 * реального трафика, которого в этом окружении пока нет — см. `isRateAnomaly`'s
 * fallback-ветку); (2) всплеск retry/429 — реальный подсчёт из `AiRequestLog`;
 * (3) всплеск стоимости дня против среднего за `COST_SPIKE_BASELINE_DAYS`
 * предыдущих дней из `AiUsageDailyAggregate` — тоже реальные данные, но
 * требует минимум эту историю, иначе честно пропускается (нет фиктивного
 * "baseline из одного дня").
 */
@Injectable()
export class AiAnomalyService {
  private readonly logger = new Logger(AiAnomalyService.name);
  private readonly rateMultiplier: number;
  private readonly retrySpikeThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.rateMultiplier = config.aiAnomalyRateMultiplier;
    this.retrySpikeThreshold = config.aiAnomalyRetrySpikeThreshold;
  }

  async recordActorActivityAndCheck(actorId: string | undefined, operation: string): Promise<void> {
    if (!actorId) return;

    const bucket = Math.floor(Date.now() / 60_000);
    const key = `${ACTOR_ACTIVITY_KEY_PREFIX}${actorId}:${bucket}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, ACTOR_ACTIVITY_KEY_TTL_SECONDS);

    if (isRateAnomaly(count, 0, this.rateMultiplier)) {
      await this.record(
        'actor_rate_spike',
        `Actor ${actorId} сделал ${count} AI-запросов за минуту (порог ${this.rateMultiplier}) — операция "${operation}"`,
        { actorId, operation, requestsPerMinute: count },
      );
    }
  }

  async checkRetrySpike(operation: string, businessId: string | undefined): Promise<void> {
    const rateLimitedCount = await this.prisma.aiRequestLog.count({
      where: {
        operation,
        businessId: businessId ?? undefined,
        status: 'rate_limited',
        createdAt: { gte: new Date(Date.now() - RETRY_SPIKE_WINDOW_MS) },
      },
    });

    if (rateLimitedCount >= this.retrySpikeThreshold) {
      await this.record(
        'retry_spike',
        `${rateLimitedCount} запросов "${operation}" получили 429 за последние ${RETRY_SPIKE_WINDOW_MS / 60_000} мин`,
        { operation, businessId, rateLimitedCount },
      );
    }
  }

  async checkCostSpike(): Promise<void> {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const baselineStart = new Date(todayStart.getTime() - COST_SPIKE_BASELINE_DAYS * 86_400_000);

    const [todayRaw, baselineAgg] = await Promise.all([
      this.prisma.aiRequestLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { costMicros: true },
      }),
      this.prisma.aiUsageDailyAggregate.groupBy({
        by: ['date'],
        where: { date: { gte: baselineStart, lt: todayStart } },
        _sum: { costMicros: true },
      }),
    ]);

    if (baselineAgg.length < 3) return; // недостаточно истории для честного baseline

    const todayCostMicros = todayRaw._sum.costMicros ?? 0;
    const baselineAverage =
      baselineAgg.reduce((sum, day) => sum + (day._sum.costMicros ?? 0), 0) / baselineAgg.length;

    if (isRateAnomaly(todayCostMicros, baselineAverage, this.rateMultiplier)) {
      await this.record(
        'cost_spike',
        `Расход сегодня (${Math.round(todayCostMicros / 1000) / 1000}$) в ${this.rateMultiplier}× выше среднего за ${baselineAgg.length} дн.`,
        { todayCostMicros, baselineAverage },
      );
    }
  }

  async listRecent(limit = RECENT_ANOMALIES_LIMIT): Promise<AiAnomalyDto[]> {
    const anomalies = await this.prisma.aiAnomaly.findMany({
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
    return anomalies.map((anomaly) => ({
      id: anomaly.id,
      type: anomaly.type,
      description: anomaly.description,
      detectedAt: anomaly.detectedAt.toISOString(),
    }));
  }

  private async record(
    type: string,
    description: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const recentDuplicate = await this.prisma.aiAnomaly.findFirst({
      where: { type, detectedAt: { gte: new Date(Date.now() - ANOMALY_DEDUP_WINDOW_MS) } },
    });
    if (recentDuplicate) return;

    this.logger.warn(`[${AI_LOG_EVENTS.ANOMALY_DETECTED}] [${type}] ${description}`);
    await this.prisma.aiAnomaly.create({
      data: { type, description, metadata: metadata as never },
    });
  }
}
