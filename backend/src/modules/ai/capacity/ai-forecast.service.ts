import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { computeForecast, type DailyUsagePoint } from './ai-capacity.lib';
import type { AiForecastDto } from './ai-capacity.types';

const HISTORY_WINDOW_DAYS = 30;
const MIN_DATA_POINTS = 3;

/**
 * Forecast Engine (§12-13 brief'а) — реальная экстраполяция по
 * `AiUsageDailyAggregate` (не сырым логам: те живут только
 * `AI_RAW_REQUEST_RETENTION_DAYS`, аггрегаты — долгосрочно). Математика — см.
 * `computeForecast` в `ai-capacity.lib.ts`; здесь только сборка временного
 * ряда из БД и перевод "сколько запросов в день выдержим" в
 * `dailyCapacity` = `GEMINI_RPD_SAFETY_LIMIT` (наш собственный
 * сконфигурированный safety-бюджет, не официальный лимит плана — прогноз
 * должен предупреждать заранее, до реального упора в лимит провайдера).
 */
@Injectable()
export class AiForecastService {
  private readonly dailyCapacity: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.dailyCapacity = configService.get<AppConfig>('app')!.geminiRpdSafetyLimit;
  }

  async getForecast(): Promise<AiForecastDto> {
    const points = await this.getDailyRequestHistory();
    const result = computeForecast(points, this.dailyCapacity, MIN_DATA_POINTS);
    return result;
  }

  private async getDailyRequestHistory(): Promise<DailyUsagePoint[]> {
    const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000);

    const rows = await this.prisma.aiUsageDailyAggregate.groupBy({
      by: ['date'],
      where: { date: { gte: since } },
      _sum: { requestCount: true },
      orderBy: { date: 'asc' },
    });

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      requestCount: row._sum.requestCount ?? 0,
    }));
  }
}
