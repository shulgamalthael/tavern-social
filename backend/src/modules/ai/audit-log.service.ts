import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AuditLogListItem, ToolRiskLevel } from './ai.types';

/** Сколько последних записей отдавать в ленту активности (AI-3, §10.7
 * роадмапа) — без query-параметра пагинации намеренно: "мини"-скоуп этой
 * фичи (см. §9.5 роадмапа, формулировка владельца), полноценный "load more"
 * — отдельная задача при реальной необходимости, не сейчас. */
const ACTIVITY_FEED_LIMIT = 30;

/** `pending`/`rejected` — AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21): confirm-флоу
 * для `high`/`critical` инструментов переиспользует ЭТУ ЖЕ таблицу как
 * хранилище незавершённого подтверждения, не заводит отдельную модель —
 * `AuditLog.status` в схеме `String`, не Prisma-enum, поэтому новые значения
 * не требуют миграции. `pending` — вызов провалидирован, но не выполнен,
 * ждёт `confirmToolCall`/`rejectToolCall` (`AiService`); `rejected` —
 * владелец отклонил, инструмент так и не выполнился. */
export type AuditLogStatus = 'success' | 'error' | 'pending' | 'rejected';

export interface AuditLogEntry {
  actorId: string;
  businessId: string | null;
  tool: string;
  riskLevel: ToolRiskLevel;
  /** Аргументы вызова, как их прислала модель (после парсинга/валидации,
   * до выполнения) — НЕ история сообщений диалога и не системный промпт
   * (mission §101-102, см. комментарий модели `AuditLog` в schema.prisma). */
  argsSummary: unknown;
  status: AuditLogStatus;
  resultSummary?: unknown;
}

export interface PendingAuditLogEntry {
  id: string;
  tool: string;
  riskLevel: ToolRiskLevel;
  /** Уже провалидированный `parseInput`-результат, сохранённый при
   * постановке в очередь (`record` со `status: 'pending'`) — `confirmToolCall`
   * передаёт его в `tool.handler` как есть, не парсит заново (AI уже не
   * участвует в этом шаге, повторно спрашивать её нечего). */
  argsSummary: unknown;
}

/** Единственное место, пишущее в `AuditLog` — тот же принцип, что у
 * `NotificationsService` для таблицы `Notification` (см.
 * `frontend/PROJECT_CONTEXT.md`, «Уведомления»). */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Возвращает `id` созданной строки — AI-9's `pending`-запись нужна
   * `AiService.runToolLoop`, чтобы отдать `confirmationId` в `AiStreamEvent`
   * (см. её комментарий); для обычных success/error-записей возврат просто
   * не используется вызывающим кодом, не требует отдельной перегрузки. */
  async record(entry: AuditLogEntry): Promise<string> {
    const row = await this.prisma.auditLog.create({
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
      select: { id: true },
    });
    return row.id;
  }

  /** Находит `pending`-запись строго внутри `businessId` (владение уже
   * проверено `AiOwnershipGuard` на уровне контроллера, здесь — вторая
   * граница, тот же принцип "никогда не доверяем клиентскому id без
   * проверки", `AGENTS.md` backend §3) — `null`, если не найдена, уже
   * обработана (`resolvePending` меняет `status`, повторный confirm/reject
   * на тот же `id` естественно перестаёт находить её) или принадлежит
   * другому бизнесу. */
  async findOwnedPending(id: string, businessId: string): Promise<PendingAuditLogEntry | null> {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, businessId, status: 'pending' },
      select: { id: true, tool: true, riskLevel: true, argsSummary: true },
    });
    if (!row) return null;
    return { id: row.id, tool: row.tool, riskLevel: row.riskLevel, argsSummary: row.argsSummary };
  }

  /** Переводит `pending`-запись в конечный статус (`success`/`error` после
   * реального выполнения, `rejected` без него) — единственное место, где
   * `AuditLog`-строка меняется после создания (обычные записи, созданные
   * сразу с конечным статусом через `record`, никогда не обновляются). */
  async resolvePending(
    id: string,
    patch: { status: AuditLogStatus; resultSummary?: unknown },
  ): Promise<void> {
    await this.prisma.auditLog.update({
      where: { id },
      data: {
        status: patch.status,
        resultSummary:
          patch.resultSummary === undefined
            ? undefined
            : (patch.resultSummary as Prisma.InputJsonValue),
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
      // `record()`/`resolvePending()` пишет (`AuditLogStatus`), так что
      // сужение здесь безопасно и ничего постороннего попасть не может.
      status: row.status as AuditLogStatus,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
