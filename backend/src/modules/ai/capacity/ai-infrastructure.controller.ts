import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { AdminGuard } from '@/common/guards/admin.guard';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { AiAlertsService } from './ai-alerts.service';
import { AiAnomalyService } from './ai-anomaly.service';
import { AiBudgetService } from './ai-budget.service';
import { AiCapacityService } from './ai-capacity.service';
import { AiForecastService } from './ai-forecast.service';
import { AiRecommendationsService } from './ai-recommendations.service';
import { AiRequestAccountingService } from './ai-request-accounting.service';
import { SetAiBudgetDto } from './dto/set-ai-budget.dto';
import type { AiInfrastructureOverviewDto } from './ai-capacity.types';

/**
 * Admin AI Infrastructure Dashboard (§30-32 brief'а) — источник данных для
 * фронтендовой панели в `/admin`. Один составной `overview` эндпоинт вместо
 * десятка разрозненных маршрутов из идеализированной §30-раскладки brief'а
 * (Overview/Usage/Tokens/Cost/Capacity/Forecast/Anomalies/Budgets/Requests/
 * Optimization как 10 отдельных разделов) — сознательное упрощение: у
 * реального трафика этого приложения нет отдельного объёма данных под
 * каждый из них, дробить один экран на 10 сетевых запросов было бы
 * искусственным усложнением ради формы, не сути (см. финальный отчёт).
 */
@Controller('admin/ai-infrastructure')
@UseGuards(SessionAuthGuard, AdminGuard)
export class AiInfrastructureController {
  constructor(
    private readonly capacity: AiCapacityService,
    private readonly accounting: AiRequestAccountingService,
    private readonly forecast: AiForecastService,
    private readonly budget: AiBudgetService,
    private readonly alerts: AiAlertsService,
    private readonly anomaly: AiAnomalyService,
    private readonly recommendations: AiRecommendationsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('overview')
  async getOverview(): Promise<AiInfrastructureOverviewDto> {
    const config = this.configService.get<AppConfig>('app')!;

    const [
      capacitySnapshot,
      cost,
      forecastResult,
      budgets,
      topOperations,
      topBusinesses,
      recentAlerts,
      recentAnomalies,
      recentRecommendations,
    ] = await Promise.all([
      this.capacity.getSnapshot(),
      this.accounting.getCostSummary(),
      this.forecast.getForecast(),
      this.budget.getBudgetStatuses(),
      this.accounting.getTopOperations(),
      this.accounting.getTopBusinesses(),
      this.alerts.listRecent(),
      this.anomaly.listRecent(),
      this.recommendations.listRecent(),
    ]);

    return {
      capacity: capacitySnapshot,
      cost,
      forecast: forecastResult,
      budgets,
      topOperations,
      topBusinesses,
      recentAlerts,
      recentAnomalies,
      recommendations: recentRecommendations,
      tierInfo: {
        providerTierDetectionAvailable: false,
        currentLimits: { rpm: config.geminiRpmLimit, rpd: config.geminiRpdLimit },
      },
    };
  }

  @Post('budgets')
  async setBudget(@Body() dto: SetAiBudgetDto): Promise<void> {
    await this.budget.setBudget(
      dto.scope,
      dto.scope === 'business' ? (dto.businessId ?? null) : null,
      dto.monthlyLimitCents,
    );
  }

  /** Ручной пересчёт рекомендаций (§24 brief'а допускает "on-demand", не
   * только периодически) — удобно для админа, не ждущего до 30 минут
   * `aiRecommendationIntervalMs`, и для верификации фичи вживую. */
  @Post('recommendations/recompute')
  async recomputeRecommendations(): Promise<void> {
    await this.recommendations.generate();
  }

  /** Аномалии по расходу дня уже проверяются автоматически после каждого
   * прогона агрегации (`AiRetentionService.run`, нужен свежий дневной
   * агрегат для baseline) — этот эндпоинт только для ручного пересчёта
   * админом вне расписания, симметрично `recompute` выше. */
  @Post('anomalies/check-cost-spike')
  async checkCostSpike(): Promise<void> {
    await this.anomaly.checkCostSpike();
  }
}
