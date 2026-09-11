import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { selectWidgetsToDemote } from './widget-catalog-gc.lib';

/**
 * "Сборщик мусора" общего каталога виджетов (AI_PLATFORM_ROADMAP.md §74,
 * запрошено владельцем прямо: "чтобы плохие и ничего не стоящие виджеты не
 * попадали в каталог") — тот же приём, что и `UploadsRetentionService`
 * (`setInterval` в `OnModuleInit`/`OnModuleDestroy`, не `@nestjs/schedule`:
 * в проекте нет этой зависимости, заводить её ради одного фонового таймера
 * избыточно).
 *
 * Дополняет, а не заменяет, приёмочную проверку при создании
 * (`assessWidgetQuality`, `widget-quality.lib.ts`) — та ловит структурно
 * пустые виджеты ДО попадания в каталог; этот sweep ловит то, что она в
 * принципе не может: виджет, который выглядел содержательным на вид, но
 * реально никому, кроме автора, не пригодился — единственный сигнал этого
 * после того, как виджет уже расшарен. "Убрать из каталога" —
 * `isShared: false`, не удаление строки: виджет остаётся приватным виджетом
 * своего изначального автора как ни в чём не бывало, только исчезает из
 * "Каталога виджетов" у всех остальных.
 */
@Injectable()
export class CustomWidgetCatalogGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomWidgetCatalogGcService.name);
  private timer: NodeJS.Timeout | undefined;
  private readonly gracePeriodMs: number;
  private readonly minInserts: number;
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.gracePeriodMs = config.widgetCatalogGraceDays * 24 * 60 * 60_000;
    this.minInserts = config.widgetCatalogMinInserts;
    this.intervalMs = config.widgetCatalogGcSweepIntervalMs;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.run().catch((error) => {
        this.logger.warn(
          `Не удалось прогнать сборщик мусора каталога виджетов: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    const shared = await this.prisma.customWidget.findMany({
      where: { isShared: true },
      select: { id: true, sharedAt: true, catalogInsertCount: true },
    });
    if (shared.length === 0) return;

    // `sharedAt` не может быть `null` для строки с `isShared: true` (см.
    // `CustomWidgetsService.create` — оба поля выставляются вместе), но
    // Prisma типизирует колонку как `Date | null` независимо от этого
    // инварианта — отфильтровываем защитно, а не приводим типы вслепую.
    const withSharedAt = shared.filter(
      (widget): widget is { id: string; sharedAt: Date; catalogInsertCount: number } =>
        widget.sharedAt !== null,
    );

    const idsToDemote = selectWidgetsToDemote(
      withSharedAt,
      new Date(),
      this.gracePeriodMs,
      this.minInserts,
    );
    if (idsToDemote.length === 0) return;

    await this.prisma.customWidget.updateMany({
      where: { id: { in: idsToDemote } },
      data: { isShared: false },
    });
    this.logger.debug(
      `Сняли с каталога ${idsToDemote.length} виджет(ов) — старше ${this.gracePeriodMs / 86_400_000} дн. и меньше ${this.minInserts} вставок другими бизнесами`,
    );
  }
}
