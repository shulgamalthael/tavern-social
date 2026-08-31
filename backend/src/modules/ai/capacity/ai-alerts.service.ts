import { Injectable, Logger } from '@nestjs/common';
import type { AiAlertSeverity } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AiAlertDto } from './ai-capacity.types';

const RECENT_ALERTS_LIMIT = 20;
/** Не создавать НОВУЮ строку алерта того же `type`, если предыдущая создана
 * младше этого окна — иначе при устойчивом WARNING/CRITICAL каждый следующий
 * AI-запрос плодил бы отдельный алерт (§16 brief'а хочет уведомление о
 * ПЕРЕХОДЕ в состояние, не о каждом запросе внутри него). */
const DEDUP_WINDOW_MS = 5 * 60_000;

/** §37 brief'а — имена структурных лог-событий, единые для всего Capacity
 * Manager (используются и здесь, и в `AiRequestAccountingService`,
 * `AiCapacityService`, `AiBudgetService`, `AiAnomalyService`). Простые
 * текстовые префиксы в `Logger`, не JSON-структурированное логирование —
 * в проекте такого нигде больше нет (см. существующий `GeminiQuotaService`),
 * заводить новый формат логов ради одного модуля было бы несогласованно. */
export const AI_LOG_EVENTS = {
  REQUEST_QUEUED: 'AI_REQUEST_QUEUED',
  REQUEST_COMPLETED: 'AI_REQUEST_COMPLETED',
  REQUEST_FAILED: 'AI_REQUEST_FAILED',
  REQUEST_429: 'AI_REQUEST_429',
  REQUEST_DEDUPLICATED: 'AI_REQUEST_DEDUPLICATED',
  REQUEST_CACHED: 'AI_REQUEST_CACHED',
  REQUEST_CANCELLED: 'AI_REQUEST_CANCELLED',
  CAPACITY_WARNING: 'AI_CAPACITY_WARNING',
  CAPACITY_CRITICAL: 'AI_CAPACITY_CRITICAL',
  CAPACITY_EMERGENCY: 'AI_CAPACITY_EMERGENCY',
  BUDGET_WARNING: 'AI_BUDGET_WARNING',
  BUDGET_EXCEEDED: 'AI_BUDGET_EXCEEDED',
  ANOMALY_DETECTED: 'AI_ANOMALY_DETECTED',
  TIER_RECOMMENDATION: 'AI_TIER_RECOMMENDATION',
} as const;

/**
 * Персистентная лента админ-алертов (§16 brief'а) поверх структурных логов —
 * дашборду нужна реальная лента из БД, не grep по контейнеру. Дедуплицирует
 * повторяющиеся алерты того же типа в скользящем окне (см. `DEDUP_WINDOW_MS`)
 * — источник истины по текущему состоянию всё равно `AiCapacityService.
 * getStatus()`/`AiBudgetService`, алерт лишь фиксирует МОМЕНТ перехода.
 */
@Injectable()
export class AiAlertsService {
  private readonly logger = new Logger(AiAlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async raise(
    type: string,
    severity: AiAlertSeverity,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const recentDuplicate = await this.prisma.aiAlert.findFirst({
      where: { type, createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recentDuplicate) return;

    this.logger.warn(`[${type}] ${message}`);
    await this.prisma.aiAlert.create({
      data: { type, severity, message, metadata: metadata as never },
    });
  }

  async listRecent(limit = RECENT_ALERTS_LIMIT): Promise<AiAlertDto[]> {
    const alerts = await this.prisma.aiAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.createdAt.toISOString(),
    }));
  }
}
