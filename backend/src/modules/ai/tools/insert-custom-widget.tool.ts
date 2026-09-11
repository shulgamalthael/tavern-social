import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { AdvertisingInventoryService } from '@/modules/advertising/advertising-inventory.service';
import { CustomWidgetsService } from '@/modules/custom-widgets/custom-widgets.service';
import {
  resolveWidgetTemplate,
  widgetFieldsNeedRefs,
} from '@/modules/custom-widgets/resolve-widget-template';
import { buildValidatedWidgetValues } from '@/modules/custom-widgets/widget-fields';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsiteBlock, WebsitePage } from '@/modules/websites/websites.types';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { buildBlockRefs } from './build-block-refs';
import { BLOCK_SCHEMAS, buildValidatedProps, type AllowedBlockType } from './lib/add-block-schemas';
import {
  assertIsContainer,
  findDisallowedChild,
  findMissingCapabilities,
} from './lib/block-placement';
import { buildValidatedStyle } from './lib/block-style-schema';
import { findBlockInPages, insertBlockIntoPage } from './lib/block-tree';
import { remapBlockIds } from './lib/remap-block-ids';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Закрывает пробел, названный ещё в §16.2 (AI_PLATFORM_ROADMAP.md) и снова
 * §50.5: `create_custom_widget` умеет СОХРАНИТЬ композицию блоков как
 * именованный виджет, но ни один AI-инструмент не умел сам её РАЗМЕСТИТЬ на
 * странице — только человек, кликом по "Мои виджеты" в билдере
 * (`ComponentLibraryPanel.tsx` → `insertWidgetBlocks`, `website-store.ts`).
 * Этот тул — backend-версия ровно того же самого действия, тем же способом
 * ("новый вызывающий старого кода"): виджет уже прошёл валидацию при
 * сохранении (`parseWidgetSchema`, `custom-widgets.types.ts`), здесь его
 * блоки просто копируются в дерево страницы со свежими id (`remapBlockIds` —
 * см. её комментарий про то, почему id обязаны быть новыми на каждую
 * вставку) — та же вставленная копия, не живая ссылка на `CustomWidget`,
 * что и у ручной вставки (изменение сохранённого виджета потом не меняет уже
 * вставленные экземпляры).
 *
 * Родитель/капабилити проверяются тем же способом, что и в `AddBlockTool` —
 * но по КАЖДОМУ блоку виджета (виджет — это N блоков одновременно, не один),
 * поэтому виджет с productgrid внутри отклоняется целиком (ничего не
 * вставляется), если у бизнеса нет капабилити commerce, а не вставляется
 * частично.
 *
 * §62.1 — если у виджета есть `fields` (параметры), `values` ОБЯЗАТЕЛЕН:
 * значения валидируются `buildValidatedWidgetValues` (та же `validateOneField`,
 * что и обычные пропсы блока), подставляются в шаблон вместо `{{fieldKey}}`
 * (`resolveWidgetTemplate`), и — критично — КАЖДЫЙ получившийся блок ЗАНОВО
 * прогоняется через `buildValidatedProps` полной схемы блока-владельца с
 * РЕАЛЬНЫМИ `refs` этого бизнеса, ПЕРЕД вставкой. Это не дублирующая
 * перестраховка: подставленное значение параметра могло технически нарушить
 * ограничение самого пропса (например, `maxLength`), и эта вторая проверка —
 * гарантия, что параметризованный виджет никогда не производит проп, который
 * не мог бы произвести обычный `add_block`/ручное редактирование. Виджет без
 * `fields` ведёт себя ИДЕНТИЧНО версии до параметризации — `values`
 * игнорируется, `widget.schema` копируется как есть.
 */

interface InsertCustomWidgetInput {
  pageId: string;
  widgetId: string;
  /** id уже существующего блока-контейнера на той же странице — тот же
   * смысл, что и у `AddBlockTool`'s `parentId`. `undefined` — блоки виджета
   * добавляются в конец страницы верхнего уровня. */
  parentId?: string;
  /** Обязателен, если у виджета есть `fields` (параметры) — реальные
   * значения на этот конкретный экземпляр, ключи — `WidgetFieldSchema.key`.
   * Игнорируется (может отсутствовать), если у виджета `fields` пуст. */
  values?: Record<string, unknown>;
}

interface InsertCustomWidgetOutput {
  pageId: string;
  widgetName: string;
  blockIds: string[];
}

@Injectable()
export class InsertCustomWidgetTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly customWidgetsService: CustomWidgetsService,
    private readonly prisma: PrismaService,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly advertisingInventoryService: AdvertisingInventoryService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<InsertCustomWidgetInput, InsertCustomWidgetOutput> = {
      name: 'insert_custom_widget',
      description:
        'Размещает уже сохранённый (через create_custom_widget или вручную владельцем) виджет на странице — в конец страницы (без parentId) или ВНУТРЬ уже существующего блока-контейнера (с parentId, тот же смысл, что у add_block). ' +
        'Каждая вставка создаёт НОВУЮ копию блоков виджета со свежими id — изменение исходного виджета потом не затронет уже вставленные копии. ' +
        'Если у виджета есть параметры (fields, см. create_custom_widget), values ОБЯЗАТЕЛЕН — объект { fieldKey: значение, ... } на каждый параметр, реальные значения подставляются в шаблон и валидируются как обычные пропсы блока. ' +
        'Полезно, когда владелец просит "добавь на страницу тот виджет, который мы сохранили" или когда виджет нужно разместить на нескольких страницах сразу с разными значениями (вызови этот инструмент несколько раз с разными values).',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'id страницы, куда добавить виджет' },
          values: {
            type: 'object',
            description:
              'Обязателен, если у виджета есть fields — { fieldKey: значение, ... }. Список полей и их kind см. в описании виджета (create_custom_widget) или спросите владельца.',
          },
          widgetId: {
            type: 'string',
            description: 'id сохранённого виджета (см. вывод create_custom_widget)',
          },
          parentId: {
            type: 'string',
            description:
              'Необязательно — id УЖЕ существующего блока-контейнера (section/container/columns/column) на этой же странице. Если передан, блоки виджета добавляются в его children, а не в конец страницы.',
          },
        },
        required: ['pageId', 'widgetId'],
      },
      parseInput: (raw): InsertCustomWidgetInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { pageId, widgetId, parentId, values } = raw as Record<string, unknown>;

        if (typeof pageId !== 'string' || pageId.trim().length === 0) {
          throw new Error('pageId обязателен и должен быть непустой строкой');
        }
        if (typeof widgetId !== 'string' || widgetId.trim().length === 0) {
          throw new Error('widgetId обязателен и должен быть непустой строкой');
        }
        if (
          parentId !== undefined &&
          (typeof parentId !== 'string' || parentId.trim().length === 0)
        ) {
          throw new Error('parentId, если передан, должен быть непустой строкой');
        }
        if (values !== undefined && (typeof values !== 'object' || values === null)) {
          throw new Error('values, если передан, должен быть объектом');
        }

        return {
          pageId,
          widgetId,
          parentId,
          values: values as Record<string, unknown> | undefined,
        };
      },
      handler: async (input, ctx: ToolContext): Promise<InsertCustomWidgetOutput> => {
        const widget = await this.customWidgetsService.get(
          ctx.businessId,
          input.widgetId,
          ctx.actorId,
        );

        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const page = draft.document.pages.find((candidate) => candidate.id === input.pageId);
        if (!page) {
          throw new Error(`Страница с id "${input.pageId}" не найдена на этом сайте`);
        }

        let parent: WebsiteBlock | undefined;
        if (input.parentId) {
          const found = findBlockInPages(draft.document.pages, input.parentId);
          if (!found || found.page.id !== page.id) {
            throw new Error(`Блок-родитель с id "${input.parentId}" не найден на этой странице`);
          }
          assertIsContainer(input.parentId, found.block.type);
          const disallowed = findDisallowedChild(
            found.block.type,
            widget.schema.map((block) => block.type),
          );
          if (disallowed) {
            throw new Error(
              `Блок "${found.block.type}" принимает только детей типа: ${disallowed.allowedTypesList} — виджет "${widget.name}" содержит блок типа "${disallowed.disallowedType}"`,
            );
          }
          parent = found.block;
        }

        // Тот же гейт, что и `AddBlockTool` — но по КАЖДОМУ блоку виджета
        // сразу: виджет с productgrid внутри не должен вставиться частично
        // на бизнесе без капабилити commerce, только целиком или не вставиться
        // вообще.
        const business = await this.prisma.business.findUnique({
          where: { id: ctx.businessId },
          select: { capabilities: true },
        });
        const missingCapabilities = findMissingCapabilities(
          widget.schema.map((block) => block.type),
          business?.capabilities ?? [],
        );
        if (missingCapabilities.length > 0) {
          throw new Error(
            `Виджет "${widget.name}" требует включённых капабилити: ${missingCapabilities.join(', ')} — у этого бизнеса они не включены, часть блоков останется пустой. Включите капабилити в настройках бизнеса или используйте другой виджет.`,
          );
        }

        // Тот же гейт, что `AddBlockTool` — но считает ВСЕ `adslot`-блоки
        // виджета сразу (виджет может содержать несколько), см. корневой
        // план фичи §1/§6.
        const requestedAdSlots = widget.schema.filter((block) => block.type === 'adslot').length;
        if (requestedAdSlots > 0) {
          const inventory = await this.advertisingInventoryService.getInventory(ctx.businessId);
          if (inventory.available < requestedAdSlots) {
            throw new Error(
              `Виджет "${widget.name}" содержит ${requestedAdSlots} рекламных слот(ов), но у бизнеса доступно только ${inventory.available} (лимит тарифа ${inventory.limit}, занято ${inventory.occupied}).`,
            );
          }
        }

        // §62.1 — виджет с параметрами: подставляем реальные значения вместо
        // `{{fieldKey}}` и заново валидируем КАЖДЫЙ блок полной схемой
        // блока-владельца (с реальными `refs` этого бизнеса) — см. комментарий
        // класса про то, зачем эта повторная проверка обязательна. Виджет
        // без `fields` (пустой массив) ведёт себя идентично версии до
        // параметризации: `resolvedSchema` — просто `widget.schema`.
        let resolvedSchema: WebsiteBlock[] = widget.schema;
        if (widget.fields.length > 0) {
          const refs = widgetFieldsNeedRefs(widget.fields)
            ? await buildBlockRefs(
                this.prisma,
                this.mediaAssetsService,
                ctx.businessId,
                ctx.actorId,
                draft.document.pages,
              )
            : undefined;
          const values = buildValidatedWidgetValues(widget.fields, input.values, refs);
          const resolved = resolveWidgetTemplate(widget.schema, values);
          resolvedSchema = resolved.map((block) => {
            try {
              return {
                id: '',
                type: block.type,
                props: buildValidatedProps(
                  BLOCK_SCHEMAS[block.type as AllowedBlockType],
                  block.props,
                  undefined,
                  refs,
                ),
                // Тот же принцип, что у `props` выше — style уже провалидирован
                // на `parseWidgetSchema`, но re-валидируем ещё раз перед тем, как
                // блок реально попадёт на страницу (гарантия "вставка виджета не
                // может дать то, что не дал бы обычный add_block/set_style",
                // даже если между сохранением виджета и вставкой менялся набор
                // допустимых полей стиля).
                ...(block.style ? { style: buildValidatedStyle(undefined, block.style) } : {}),
              };
            } catch (error) {
              throw new Error(
                `Виджет "${widget.name}": подставленные значения дали недопустимый блок "${block.type}" — ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          });
        }

        const freshBlocks = resolvedSchema.map(remapBlockIds);
        const startIndex = parent ? (parent.children?.length ?? 0) : page.blocks.length;

        let updatedPages: WebsitePage[] = draft.document.pages;
        for (const [offset, block] of freshBlocks.entries()) {
          updatedPages = insertBlockIntoPage(
            updatedPages,
            page.id,
            block,
            parent?.id ?? null,
            startIndex + offset,
          );
        }

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        // Общий каталог виджетов (AI_PLATFORM_ROADMAP.md §74) — если этот
        // виджет принадлежит ДРУГОМУ бизнесу (значит, он расшарен, иначе
        // `customWidgetsService.get` выше бросил бы "не найден"), это
        // подтверждённая вставка ЧУЖИМ бизнесом, а не автором самому себе —
        // единственное доказательство, что каталожная запись кому-то ещё
        // реально пригодилась (см. `recordCatalogInsert`'s комментарий).
        if (widget.businessId !== ctx.businessId) {
          await this.customWidgetsService.recordCatalogInsert(widget.id, ctx.businessId);
        }

        return {
          pageId: page.id,
          widgetName: widget.name,
          blockIds: freshBlocks.map((block) => block.id),
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
