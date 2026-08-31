import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AiAnomalyService } from './ai-anomaly.service';

/**
 * §29 brief'а — "не хранить бесконечно подробные raw telemetry events,
 * использовать aggregation". Упрощено относительно raw→hourly→daily из
 * brief'а до raw→daily (без отдельной hourly-таблицы) — при реальном объёме
 * трафика этого приложения (единицы-десятки запросов в день, см. диалог
 * перед реализацией) hourly-агрегаты почти всегда были бы пустыми рядом с
 * daily; "сегодняшний" срез с часовой детализацией и так доступен из сырых
 * `AiRequestLog` (retention `AI_RAW_REQUEST_RETENTION_DAYS`, по умолчанию 7
 * дней) — заводить пустую по факту таблицу было бы той спекулятивной
 * инфраструктурой, от которой в проекте всюду отказываются.
 *
 * Идемпотентно (upsert по `@@unique([date, businessId, operation])`) —
 * повторный прогон агрегации за уже обработанный день просто пересчитывает
 * те же тоталы, безопасно перезапускать/дублировать таймер между
 * инстансами backend.
 */
@Injectable()
export class AiRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRetentionService.name);
  private timer: NodeJS.Timeout | undefined;
  private readonly intervalMs: number;
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly anomaly: AiAnomalyService,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.intervalMs = config.aiAggregationIntervalMs;
    this.retentionDays = config.aiRawRequestRetentionDays;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.run().catch((error) => {
        this.logger.warn(
          `Не удалось выполнить агрегацию/ретеншен: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    await this.aggregateCompletedDays();
    await this.pruneOldRawLogs();
    // Сразу после агрегации — самый естественный момент для cost-spike
    // проверки (нужен свежий дневной агрегат для baseline, см.
    // `AiAnomalyService.checkCostSpike`), отдельный таймер под это заводить
    // избыточно.
    await this.anomaly.checkCostSpike();
  }

  /** Агрегирует только ПОЛНОСТЬЮ завершённые дни (строго раньше сегодняшнего
   * UTC-дня) — сегодняшний день ещё накапливается, агрегировать его было бы
   * преждевременно (см. `AiBudgetService.getMonthSpendMicros`'s комментарий
   * про то, почему это разграничение важно для бюджетов без двойного счёта). */
  private async aggregateCompletedDays(): Promise<void> {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // Группировка Prisma не умеет одновременно группировать по дню (только по
    // колонкам as-is, `createdAt` — timestamp, не date) — берём точные строки
    // за диапазон и агрегируем по дню в JS. Объём ограничен retention'ом
    // (по умолчанию 7 дней сырых логов), для реального трафика этого
    // приложения — не проблема производительности.
    const rows = await this.prisma.aiRequestLog.findMany({
      where: { createdAt: { lt: todayStart } },
      select: {
        createdAt: true,
        businessId: true,
        operation: true,
        status: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costMicros: true,
      },
    });

    if (rows.length === 0) return;

    const buckets = new Map<
      string,
      {
        date: string;
        businessId: string | null;
        operation: string;
        requestCount: number;
        successCount: number;
        failedCount: number;
        rateLimitedCount: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        costMicros: number;
      }
    >();

    for (const row of rows) {
      const date = row.createdAt.toISOString().slice(0, 10);
      const key = `${date}|${row.businessId ?? ''}|${row.operation}`;
      const bucket = buckets.get(key) ?? {
        date,
        businessId: row.businessId,
        operation: row.operation,
        requestCount: 0,
        successCount: 0,
        failedCount: 0,
        rateLimitedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costMicros: 0,
      };

      bucket.requestCount += 1;
      if (row.status === 'success') bucket.successCount += 1;
      else if (row.status === 'failed') bucket.failedCount += 1;
      else if (row.status === 'rate_limited') bucket.rateLimitedCount += 1;
      bucket.inputTokens += row.inputTokens ?? 0;
      bucket.outputTokens += row.outputTokens ?? 0;
      bucket.totalTokens += row.totalTokens ?? 0;
      bucket.costMicros += row.costMicros ?? 0;

      buckets.set(key, bucket);
    }

    for (const bucket of buckets.values()) {
      await this.prisma.aiUsageDailyAggregate.upsert({
        where: {
          date_businessId_operation: {
            date: new Date(`${bucket.date}T00:00:00.000Z`),
            businessId: bucket.businessId ?? '',
            operation: bucket.operation,
          },
        },
        create: {
          date: new Date(`${bucket.date}T00:00:00.000Z`),
          businessId: bucket.businessId,
          operation: bucket.operation,
          requestCount: bucket.requestCount,
          successCount: bucket.successCount,
          failedCount: bucket.failedCount,
          rateLimitedCount: bucket.rateLimitedCount,
          inputTokens: bucket.inputTokens,
          outputTokens: bucket.outputTokens,
          totalTokens: bucket.totalTokens,
          costMicros: bucket.costMicros,
        },
        update: {
          requestCount: bucket.requestCount,
          successCount: bucket.successCount,
          failedCount: bucket.failedCount,
          rateLimitedCount: bucket.rateLimitedCount,
          inputTokens: bucket.inputTokens,
          outputTokens: bucket.outputTokens,
          totalTokens: bucket.totalTokens,
          costMicros: bucket.costMicros,
        },
      });
    }

    this.logger.debug(`Агрегировано ${buckets.size} дневных срезов (businessId×operation)`);
  }

  private async pruneOldRawLogs(): Promise<void> {
    const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);
    const { count } = await this.prisma.aiRequestLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0)
      this.logger.debug(
        `Удалено ${count} устаревших строк ai_request_logs (retention ${this.retentionDays} дн.)`,
      );
  }
}
