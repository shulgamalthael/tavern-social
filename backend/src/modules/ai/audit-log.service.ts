import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AuditLogListItem, ToolRiskLevel } from './ai.types';

/** Сколько последних записей отдавать в ленту активности (AI-3, §10.7
 * роадмапа) — без query-параметра пагинации намеренно: "мини"-скоуп этой
 * фичи (см. §9.5 роадмапа, формулировка владельца), полноценный "load more"
 * — отдельная задача при реальной необходимости, не сейчас. */
const ACTIVITY_FEED_LIMIT = 30;

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

  /** Только `id`/`tool`/`riskLevel`/`status`/`createdAt` — намеренно не
   * `select: { ...}` с `argsSummary`/`resultSummary` (см. `AuditLogListItem`
   * комментарий в `ai.types.ts`: это внутренний срез для разработчиков, не
   * для показа владельцу бизнеса в UI). */
  async listForBusiness(businessId: string): Promise<AuditLogListItem[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_FEED_LIMIT,
      select: { id: true, tool: true, riskLevel: true, status: true, createdAt: true },
    });

    return rows.map((row) => ({
      id: row.id,
      tool: row.tool,
      riskLevel: row.riskLevel,
      // `status` — `String` в схеме (см. комментарий модели в
      // schema.prisma), не enum — сюда попадает только то, что сам же
      // `record()` пишет (`'success' | 'error'`, см. `AuditLogEntry`), так
      // что сужение здесь безопасно и ничего постороннего попасть не может.
      status: row.status as 'success' | 'error',
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
