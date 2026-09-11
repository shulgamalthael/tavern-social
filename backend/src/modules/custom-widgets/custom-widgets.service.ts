import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CustomWidget } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateCustomWidgetDto } from './dto/create-custom-widget.dto';
import type { UpdateCustomWidgetDto } from './dto/update-custom-widget.dto';
import {
  parseWidgetSchema,
  type CatalogWidgetDto,
  type CustomWidgetDto,
} from './custom-widgets.types';
import { parseWidgetFields } from './widget-fields';
import { assessWidgetQuality } from './widget-quality.lib';

/** Заполнено только когда `create()` получил `options.autoShare: true`, но
 * виджет НЕ попал в общий каталог (не прошёл `assessWidgetQuality` или уже
 * есть почти-дубликат) — `create_custom_widget` (AI-тул) возвращает это
 * значение как есть, чтобы модель могла честно объяснить владельцу причину. */
export interface CreateCustomWidgetResult extends CustomWidgetDto {
  shareRejectionReason?: string;
}

/** Найденная и закрытая уязвимость (AI_PLATFORM_ROADMAP.md §75) — без этого
 * предела один бизнес мог бы бесконечно просить AI создавать виджеты,
 * каждый раз чуть-чуть проходящие `assessWidgetQuality`, и завалить общий
 * каталог собственными записями — GC (`CustomWidgetCatalogGcService`)
 * убирает только НЕиспользуемые записи спустя grace-период, а не защищает
 * от самого первого наплыва. 20 — с запасом выше того, что реально нужно
 * одному бизнесу одновременно расшарить. */
const MAX_SHARED_WIDGETS_PER_BUSINESS = 20;

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
 *
 * Общий каталог виджетов (AI_PLATFORM_ROADMAP.md §74) — `list`/`update`/
 * `remove` остаются строго owner-scoped, как и были; `create`/`get`/
 * `listCatalog`/`recordCatalogInsert` — новые исключения, см. их
 * собственные комментарии.
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

  /** Один виджет по id — для `insert_custom_widget` (AI-инструмент,
   * `modules/ai/tools/insert-custom-widget.tool.ts`): тот встраивает уже
   * СОХРАНЁННЫЙ виджет в страницу, ему нужен именно один найденный объект,
   * не весь список. В отличие от `update`/`remove` (только свой виджет,
   * `findOwnedWidget`), здесь допускается ЛИБО свой виджет, ЛИБО ЛЮБОЙ
   * расшаренный виджет каталога (§74) — вставить можно чужой виджет из
   * каталога, отредактировать/удалить чужой по-прежнему нельзя. */
  async get(businessId: string, widgetId: string, ownerId: string): Promise<CustomWidgetDto> {
    await this.assertOwnership(businessId, ownerId);
    const widget = await this.prisma.customWidget.findFirst({
      where: { id: widgetId, OR: [{ businessId }, { isShared: true }] },
    });
    if (!widget) throw new NotFoundException('Виджет не найден');
    return this.toDto(widget);
  }

  /** `options.autoShare` — передаётся ТОЛЬКО из `CreateCustomWidgetTool`
   * (AI-путь): owner-only REST (`CustomWidgetsController`) никогда его не
   * передаёт, значит виджет, созданный вручную через дашборд, никогда не
   * попадает в общий каталог сам по себе — осознанная граница слайса (§74),
   * не пробел. Когда `autoShare` передан, виджет проходит `assessWidgetQuality`
   * (детерминированная эвристика, не ещё один вызов Gemini) и проверку на
   * почти-дубликат среди уже расшаренных виджетов (`schemaHash`) — не
   * прошедший СОЗДАЁТСЯ как обычно (владелец всё равно получает то, что
   * попросил), просто не входит в `isShared` каталог, а причина возвращается
   * вызывающему в `shareRejectionReason`, чтобы AI мог честно объяснить
   * владельцу, почему. `schemaHash` считается для КАЖДОГО виджета, не только
   * расшариваемых — дёшево (чистая функция) и не даёт лишней DB-проверки на
   * дубликат, если он позже всё же попробует расшариться (`update` эту
   * возможность в этом слайсе не даёт, но хэш уже готов на будущее). */
  async create(
    businessId: string,
    ownerId: string,
    dto: CreateCustomWidgetDto,
    options?: { autoShare?: boolean },
  ): Promise<CreateCustomWidgetResult> {
    await this.assertOwnership(businessId, ownerId);
    const fields = parseWidgetFields(dto.fields);
    const declaredFieldKeys = new Set(fields.map((field) => field.key));
    const schema = parseWidgetSchema(dto.schema, declaredFieldKeys);
    const quality = assessWidgetQuality(schema, declaredFieldKeys);

    let isShared = false;
    let sharedAt: Date | null = null;
    let shareRejectionReason: string | undefined;

    if (options?.autoShare) {
      if (!quality.passes) {
        shareRejectionReason = quality.reason;
      } else {
        const sharedByThisBusiness = await this.prisma.customWidget.count({
          where: { businessId, isShared: true },
        });
        if (sharedByThisBusiness >= MAX_SHARED_WIDGETS_PER_BUSINESS) {
          shareRejectionReason = `У вас уже ${MAX_SHARED_WIDGETS_PER_BUSINESS} виджетов в общем каталоге — это предел на один бизнес.`;
        } else {
          const duplicate = await this.prisma.customWidget.findFirst({
            where: { isShared: true, schemaHash: quality.schemaHash },
            select: { id: true },
          });
          if (duplicate) {
            shareRejectionReason = 'В общем каталоге уже есть виджет с таким же содержимым.';
          } else {
            isShared = true;
            sharedAt = new Date();
          }
        }
      }
    }

    const widget = await this.prisma.customWidget.create({
      data: {
        businessId,
        name: dto.name,
        schema: schema as never,
        fields: fields as never,
        isShared,
        sharedAt,
        schemaHash: quality.schemaHash,
      },
    });
    const result: CreateCustomWidgetResult = this.toDto(widget);
    if (shareRejectionReason) result.shareRejectionReason = shareRejectionReason;
    return result;
  }

  /** Весь общий каталог (§74) — НЕ owner-scoped, любой залогиненный бизнес
   * видит один и тот же список (см. `WidgetCatalogController`, без
   * `assertOwnership`). `CatalogWidgetDto` намеренно уже, чем
   * `CustomWidgetDto` — без `businessId`, каталог анонимен. */
  async listCatalog(): Promise<CatalogWidgetDto[]> {
    const widgets = await this.prisma.customWidget.findMany({
      where: { isShared: true },
      orderBy: { createdAt: 'desc' },
    });
    return widgets.map((widget) => ({
      id: widget.id,
      name: widget.name,
      schema: widget.schema as unknown as CatalogWidgetDto['schema'],
      fields: widget.fields as unknown as CatalogWidgetDto['fields'],
    }));
  }

  /** Учитывает вставку каталожного виджета ДРУГИМ бизнесом — единственное
   * доказательство, что запись каталога кому-то реально пригодилась, см.
   * `CustomWidgetCatalogGcService`. Тихий no-op на "виджет не найден"/"уже
   * не расшарен"/"это тот же бизнес, что и автор" — вызывается и вручную с
   * frontend (fire-and-forget), и из `InsertCustomWidgetTool`, ни один из
   * них не должен упасть на устаревшей/некорректной ситуации, это просто
   * счётчик, не критичная операция. */
  async recordCatalogInsert(widgetId: string, insertingBusinessId: string): Promise<void> {
    const widget = await this.prisma.customWidget.findUnique({
      where: { id: widgetId },
      select: { businessId: true, isShared: true },
    });
    if (!widget || !widget.isShared || widget.businessId === insertingBusinessId) return;

    // `@@unique([widgetId, businessId])` — тот же приём, что `Communities
    // Service.join`: `create` тихо не удаётся (`.catch(() => null)`), если
    // строка для этой пары уже есть, и тогда счётчик НЕ инкрементируется.
    // Без этого один и тот же бизнес мог бы вызывать этот метод (напрямую,
    // не через UI) в цикле и искусственно накручивать себе бессмертие в
    // каталоге, обходя GC (`CustomWidgetCatalogGcService`) — реальная,
    // найденная и закрытая уязвимость, см. `CustomWidgetCatalogInsert`'s
    // комментарий в schema.prisma.
    const created = await this.prisma.customWidgetCatalogInsert
      .create({ data: { widgetId, businessId: insertingBusinessId } })
      .catch(() => null);
    if (!created) return;

    await this.prisma.customWidget.update({
      where: { id: widgetId },
      data: { catalogInsertCount: { increment: 1 } },
    });
  }

  async update(
    businessId: string,
    widgetId: string,
    ownerId: string,
    dto: UpdateCustomWidgetDto,
  ): Promise<CustomWidgetDto> {
    await this.assertOwnership(businessId, ownerId);
    const existing = await this.findOwnedWidget(businessId, widgetId);

    // `fields` и `schema` валидируются вместе, даже если пришло только одно
    // из двух — плейсхолдеры в НЕ обновлённом `schema` всё равно должны
    // остаться согласованы с (возможно новым) списком `fields`, и наоборот
    // (переименование/удаление параметра не должно молча оставить в схеме
    // плейсхолдер на несуществующий ключ).
    const fields = dto.fields !== undefined ? parseWidgetFields(dto.fields) : undefined;
    const declaredFieldKeys = new Set(
      (fields ?? (existing.fields as unknown as { key: string }[])).map((field) => field.key),
    );
    const schema =
      dto.schema !== undefined ? parseWidgetSchema(dto.schema, declaredFieldKeys) : undefined;

    const widget = await this.prisma.customWidget.update({
      where: { id: widgetId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(schema !== undefined ? { schema: schema as never } : {}),
        ...(fields !== undefined ? { fields: fields as never } : {}),
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

  /** Публичный (не `private`) — тот же приём, что и `AdCampaignsService.
   * assertOwnership`: `WidgetCatalogController.recordInsert` вызывает его
   * перед `recordCatalogInsert`, чтобы подтвердить, что `businessId` в теле
   * запроса реально принадлежит вызывающему, а не любому чужому бизнесу. */
  async assertOwnership(businessId: string, ownerId: string): Promise<void> {
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
      fields: widget.fields as unknown as CustomWidgetDto['fields'],
      status: widget.status,
      isShared: widget.isShared,
      createdAt: widget.createdAt.toISOString(),
      updatedAt: widget.updatedAt.toISOString(),
    };
  }
}
