import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { PlanEventDto, PlanEventType, PlanTier } from './billing.types';

/** Сколько последних событий отдавать в историю тарифа ("Payment Plans v1",
 * см. `BillingService.listHistory`) — тот же "мини"-скоуп, что у
 * `AuditLogService.ACTIVITY_FEED_LIMIT`: полноценный "load more" — отдельная
 * задача при реальной необходимости. */
const PLAN_HISTORY_LIMIT = 30;

export interface PlanSelectionEventEntry {
  businessId: string;
  actorId: string | null;
  type: PlanEventType;
  tier: PlanTier | null;
  metadata?: Record<string, unknown>;
}

/** Единственное место, пишущее в `PlanSelectionEvent` — тот же принцип, что
 * у `AuditLogService` для `AuditLog`/`NotificationsService` для
 * `Notification`: append-only audit trail, никогда не UPDATE/DELETE. */
@Injectable()
export class PlanSelectionEventService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: PlanSelectionEventEntry): Promise<void> {
    await this.prisma.planSelectionEvent.create({
      data: {
        businessId: entry.businessId,
        actorId: entry.actorId,
        type: entry.type,
        tier: entry.tier,
        metadata:
          entry.metadata === undefined ? undefined : (entry.metadata as Prisma.InputJsonValue),
      },
    });
  }

  async listForBusiness(businessId: string): Promise<PlanEventDto[]> {
    const rows = await this.prisma.planSelectionEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: PLAN_HISTORY_LIMIT,
      select: { id: true, type: true, tier: true, createdAt: true },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      tier: row.tier,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
