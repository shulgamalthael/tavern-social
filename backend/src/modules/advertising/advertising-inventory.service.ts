import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { getAdSlotLimit } from '@/modules/billing/ad-entitlements';
import type { AdInventoryDto } from './advertising.types';
import { countBlocksOfType } from './lib/count-ad-slot-blocks';

/**
 * Единственный источник истины "сколько рекламных слотов доступно этому
 * бизнесу и сколько уже занято" (см. корневой план фичи, §1). Намеренно
 * НЕ читает `Business.capabilities` — тот массив владелец-переключаемый и
 * независим от тарифа (см. её комментарий в schema.prisma), а рекламный
 * лимит — производная от `PlanTier`, владелец не должен иметь возможность
 * включить его себе просто отредактировав `PATCH /business`. Отдельный,
 * выделенный гейт, вызываемый из тех же мест, что и `findMissingCapabilities`
 * сегодня (`ComponentLibraryPanel.tsx` на frontend, `AddBlockTool`/
 * `InsertCustomWidgetTool` на backend), но независимо от него.
 */
@Injectable()
export class AdvertisingInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Без проверки владения — вызывающий код либо сам уже в owner-контексте
   * (AI-инструменты — `ctx.businessId` уже принадлежит текущему актору),
   * либо admin-контексте (`AdminAdvertisingController` — не привязан к
   * одному владельцу). Владелец-facing REST путь — `getInventoryForOwner`
   * ниже. */
  async getInventory(businessId: string): Promise<AdInventoryDto> {
    const [subscription, pages] = await Promise.all([
      this.prisma.businessSubscription.findUnique({
        where: { businessId },
        select: { tier: true },
      }),
      this.prisma.websitePage.findMany({
        where: { website: { businessId } },
        select: { content: true },
      }),
    ]);

    const tier = subscription?.tier ?? null;
    const limit = getAdSlotLimit(tier);
    const occupied = countBlocksOfType(
      pages.map((page) => page.content),
      'adslot',
    );

    return { tier, limit, occupied, available: Math.max(0, limit - occupied) };
  }

  /** Тот же принцип, что `BillingService.getStatus(businessId, ownerId)` —
   * ownership проверяется здесь, а не в контроллере (см. `AGENTS.md`
   * backend, паттерн owner-scoped сервисов). */
  async getInventoryForOwner(businessId: string, ownerId: string): Promise<AdInventoryDto> {
    await this.assertOwnership(businessId, ownerId);
    return this.getInventory(businessId);
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }
}
