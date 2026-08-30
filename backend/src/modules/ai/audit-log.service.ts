import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { ToolRiskLevel } from './ai.types';

export interface AuditLogEntry {
  actorId: string;
  businessId: string | null;
  tool: string;
  riskLevel: ToolRiskLevel;
  /** Аргументы вызова, как их прислала модель (после парсинга/валидации,
   * до выполнения) — НЕ история сообщений диалога и не системный промпт
   * (mission §101-102, см. комментарий модели `AuditLog` в schema.prisma). */
  argsSummary: unknown;
  status: 'success' | 'error';
  resultSummary?: unknown;
}

/** Единственное место, пишущее в `AuditLog` — тот же принцип, что у
 * `NotificationsService` для таблицы `Notification` (см.
 * `frontend/PROJECT_CONTEXT.md`, «Уведомления»). */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        businessId: entry.businessId,
        tool: entry.tool,
        riskLevel: entry.riskLevel,
        argsSummary: entry.argsSummary ?? {},
        status: entry.status,
        resultSummary:
          entry.resultSummary === undefined
            ? undefined
            : (entry.resultSummary as Prisma.InputJsonValue),
      },
    });
  }
}
