import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CustomWidget } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateCustomWidgetDto } from './dto/create-custom-widget.dto';
import type { UpdateCustomWidgetDto } from './dto/update-custom-widget.dto';
import { parseWidgetSchema, type CustomWidgetDto } from './custom-widgets.types';

/**
 * Custom Widget Engine v1 (AI_PLATFORM_ROADMAP.md §2.4, AI-6's первый
 * ограниченный слайс) — owner-CRUD, тот же паттерн, что `DiscountsService`/
 * `RulesService` (`assertOwnership` на каждый вызов, `findOwnedWidget` для
 * update/remove).
 *
 * Намеренно НЕТ отдельного backend-метода "встроить виджет в страницу" — это
 * НЕ значит, что встраивания нет вообще (§16.2 его добавил): вставка сделана
 * целиком на фронтенде (`ComponentLibraryPanel`'s секция «Мои виджеты» →
 * `website-store.ts`'s `insertWidgetBlocks`, свежие `id` на каждую вставку
 * через `remapBlockIds`), переиспользуя уже существующий `WebsitesService.
 * saveDraft` — тот же принцип "новый вызывающий старого кода", что и у
 * AI-инструментов. Backend-у не нужен отдельный эндпоинт для этого: список
 * виджетов (`GET .../widgets`, ниже) уже отдаёт весь `schema`, вставка — это
 * просто копирование его блоков в `WebsitePage.blocks` с новыми id, тот же
 * путь записи, что и любое другое изменение документа сайта.
 *
 * Вставленная копия НЕ остаётся связанной с исходным `CustomWidget` —
 * снимок на момент вставки, не живая ссылка (осознанный выбор из двух,
 * которые раньше были открытым вопросом, см. §16.2): изменение виджета
 * потом не меняет уже вставленные экземпляры, тот же принцип, что у
 * стартовых шаблонов (`applyTemplate` тоже копирует блоки один раз, без
 * долгоживущей связи с `STARTER_TEMPLATES`).
 */
@Injectable()
export class CustomWidgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string, ownerId: string): Promise<CustomWidgetDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const widgets = await this.prisma.customWidget.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return widgets.map((widget) => this.toDto(widget));
  }

  async create(
    businessId: string,
    ownerId: string,
    dto: CreateCustomWidgetDto,
  ): Promise<CustomWidgetDto> {
    await this.assertOwnership(businessId, ownerId);
    const schema = parseWidgetSchema(dto.schema);

    const widget = await this.prisma.customWidget.create({
      data: { businessId, name: dto.name, schema: schema as never },
    });
    return this.toDto(widget);
  }

  async update(
    businessId: string,
    widgetId: string,
    ownerId: string,
    dto: UpdateCustomWidgetDto,
  ): Promise<CustomWidgetDto> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedWidget(businessId, widgetId);

    const widget = await this.prisma.customWidget.update({
      where: { id: widgetId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.schema !== undefined ? { schema: parseWidgetSchema(dto.schema) as never } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return this.toDto(widget);
  }

  async remove(businessId: string, widgetId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedWidget(businessId, widgetId);
    await this.prisma.customWidget.delete({ where: { id: widgetId } });
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private async findOwnedWidget(businessId: string, widgetId: string): Promise<CustomWidget> {
    const widget = await this.prisma.customWidget.findFirst({
      where: { id: widgetId, businessId },
    });
    if (!widget) throw new NotFoundException('Виджет не найден');
    return widget;
  }

  private toDto(widget: CustomWidget): CustomWidgetDto {
    return {
      id: widget.id,
      businessId: widget.businessId,
      name: widget.name,
      schema: widget.schema as unknown as CustomWidgetDto['schema'],
      status: widget.status,
      createdAt: widget.createdAt.toISOString(),
      updatedAt: widget.updatedAt.toISOString(),
    };
  }
}
