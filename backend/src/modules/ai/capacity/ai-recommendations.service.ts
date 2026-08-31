import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AI_LOG_EVENTS } from './ai-alerts.service';
import { AiForecastService } from './ai-forecast.service';
import { AiRequestAccountingService } from './ai-request-accounting.service';
import type { AiRecommendationDto } from './ai-capacity.types';

const RECENT_RECOMMENDATIONS_LIMIT = 20;
const DEDUP_WINDOW_MS = 60 * 60_000;
/** Минимум реальных запросов, прежде чем выводить рекомендации по операциям/
 * эффективности — на единицах тестовых запросов любой процент выглядит
 * "значимым", хотя это просто шум малой выборки. */
const MIN_REQUESTS_FOR_OPERATION_INSIGHT = 20;
const DOMINANT_OPERATION_SHARE_PERCENT = 40;
const FORECAST_WARNING_DAYS = 30;

/**
 * Recommendation Engine (§14, §25 brief'а) — периодический (НЕ на каждый
 * запрос, см. §24: "AI не должен становиться причиной дополнительного
 * AI-расхода") пересчёт через `setInterval`, тот же приём таймера, что
 * `AiCapacityService`'s snapshot writer. Читает исключительно уже собранную
 * телеметрию (`AiForecastService`, `AiRequestAccountingService`) — сам
 * Recommendation Engine НЕ вызывает Gemini ни разу, это обычный backend-код
 * (arithmetic/SQL), не AI-анализ AI-расхода.
 *
 * Рекомендации READ-ONLY — никогда не меняют биллинг/лимиты провайдера сами
 * (§26 brief'а: "не разрешать без explicit admin approval"), только
 * записываются в `AiRecommendation` для админ-дашборда.
 */
@Injectable()
export class AiRecommendationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRecommendationsService.name);
  private timer: NodeJS.Timeout | undefined;
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: AiForecastService,
    private readonly accounting: AiRequestAccountingService,
    configService: ConfigService,
  ) {
    this.intervalMs = configService.get<AppConfig>('app')!.aiRecommendationIntervalMs;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.generate().catch((error) => {
        this.logger.warn(
          `Не удалось сгенерировать рекомендации: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async generate(): Promise<void> {
    await this.checkCapacityForecast();
    await this.checkDominantOperation();
    await this.checkEfficiency();
  }

  async listRecent(limit = RECENT_RECOMMENDATIONS_LIMIT): Promise<AiRecommendationDto[]> {
    const rows = await this.prisma.aiRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async checkCapacityForecast(): Promise<void> {
    const result = await this.forecast.getForecast();
    if (!result.sufficientData || result.daysUntilCapacityInsufficient === null) return;
    if (result.daysUntilCapacityInsufficient > FORECAST_WARNING_DAYS) return;

    await this.record(
      'increase_capacity',
      `При текущем росте (${result.averageDailyGrowthPercent}%/день) текущей RPD-квоты может не хватить примерно через ${result.daysUntilCapacityInsufficient} дн. — рассмотрите увеличение лимита плана Gemini.`,
    );
  }

  private async checkDominantOperation(): Promise<void> {
    const topOperations = await this.accounting.getTopOperations();
    const total = topOperations.reduce((sum, item) => sum + item.requestCount, 0);
    if (total < MIN_REQUESTS_FOR_OPERATION_INSIGHT) return;

    const dominant = topOperations[0];
    if (!dominant) return;
    const share = Math.round((dominant.requestCount / total) * 100);
    if (share < DOMINANT_OPERATION_SHARE_PERCENT) return;

    await this.record(
      'dominant_operation',
      `Операция "${dominant.operation}" — ${share}% всех AI-запросов за последние 7 дней (${dominant.requestCount} из ${total}).`,
    );
  }

  private async checkEfficiency(): Promise<void> {
    const snapshot = await this.accounting.getEfficiencySnapshot();
    const total = snapshot.realRequests + snapshot.cached + snapshot.deduplicated;
    if (total < MIN_REQUESTS_FOR_OPERATION_INSIGHT) return;

    const avoidedPercent = Math.round(((snapshot.cached + snapshot.deduplicated) / total) * 100);
    if (avoidedPercent < 5) return;

    await this.record(
      'efficiency',
      `${avoidedPercent}% AI-запросов избежали реального обращения к Gemini (кэш: ${snapshot.cached}, дедупликация: ${snapshot.deduplicated}).`,
    );
  }

  private async record(type: string, message: string): Promise<void> {
    const recentDuplicate = await this.prisma.aiRecommendation.findFirst({
      where: { type, createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) } },
    });
    if (recentDuplicate) return;

    this.logger.log(`[${AI_LOG_EVENTS.TIER_RECOMMENDATION}] [${type}] ${message}`);
    await this.prisma.aiRecommendation.create({ data: { type, message } });
  }
}
