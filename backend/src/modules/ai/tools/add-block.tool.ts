import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsiteBlock, WebsitePage } from '@/modules/websites/websites.types';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { buildBlockRefs, needsBlockRefs } from './build-block-refs';
import {
  ALLOWED_BLOCK_TYPES,
  ALLOWED_CHILDREN,
  BLOCK_SCHEMAS,
  CONTAINER_BLOCK_TYPES,
  buildValidatedProps,
  isAllowedBlockType,
  type AllowedBlockType,
  type BuildValidatedPropsRefs,
} from './lib/add-block-schemas';
import { findBlockInPages, replaceBlockInPages } from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Второй записывающий AI-инструмент (AI_PLATFORM_ROADMAP.md, фаза AI-2,
 * продолжение после `create_page`, см. §7 роадмапа). Как и было
 * анонсировано там: `update_block_props`/`set_style` откладывались, пока
 * не появился переносимый на backend валидатор `BlockDefinition.fields` (§3
 * — AI-генерируемые `props` — untrusted input, а backend не может прочитать
 * frontend-реестр напрямую).
 *
 * Вместо переноса ВСЕГО реестра (все 12 категорий, `control: 'dataSource'`/
 * `'list'` с их структурными формами) — узкий allowlist (mission §21
 * "allowlist > blocklist", уже применённый в этом плане к custom-widget
 * engine, §2.4). `image`/`button` (AI_PLATFORM_ROADMAP.md §9.6/§16 —
 * согласовано с пользователем сразу широким v1) добавлены поверх исходных
 * 4 типографических/layout-блоков: `image.src` — только уже загруженный
 * файл (`list_media_assets`, AI сам ничего не грузит), `link`/`url` —
 * полный `LinkTarget` из 7 вариантов, включая `addToCart`/`bookAppointment`
 * (см. `lib/link-target-schema.ts`). `web3wallet` (AI_PLATFORM_ROADMAP.md
 * §35, AI-20) — первый живой-данными блок в этом allowlist, без
 * `mediaAsset`/`linkTarget` полей вообще, см. `add-block-schemas.ts`.
 * `productgrid`/`gallery`/остальные `control: 'dataSource'`-блоки
 * по-прежнему НЕ поддержаны — та форма (`{limit, sort}` + `entity`) требует
 * отдельного вида поля, не заведённого здесь ради одного этого блока.
 *
 * `section`/`container`/`columns`/`column` (раскладка, следующая итерация
 * после первого узкого v1 выше) — единственные типы здесь, у которых можно
 * задать `parentId`: без вложенности эти четыре типа бесполезны (весь их
 * смысл — раскладывать ДРУГИЕ блоки внутри себя через `BlockStyle`'s поля
 * «Раскладка», см. `set-style.tool.ts`), поэтому `parentId` — не общая
 * возможность для любого блока, а именно то, чего им не хватало. `columns`
 * донашивает то же ограничение, что и в ручном билдере (`allowedChildren`,
 * `entities/website/blocks/layout/index.tsx`) — единственный допустимый
 * ребёнок `column`, см. `ALLOWED_CHILDREN`/`CONTAINER_BLOCK_TYPES` в
 * `add-block-schemas.ts`.
 */

interface AddBlockInput {
  pageId: string;
  blockType: AllowedBlockType;
  props: Record<string, unknown>;
  /** id УЖЕ существующего блока-контейнера на той же странице — блок
   * добавляется в его `children`, а не в конец страницы. `undefined` —
   * прежнее поведение (конец страницы верхнего уровня). */
  parentId?: string;
}

interface AddBlockOutput {
  pageId: string;
  blockId: string;
  blockType: AllowedBlockType;
}

@Injectable()
export class AddBlockTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly prisma: PrismaService,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<AddBlockInput, AddBlockOutput> = {
      name: 'add_block',
      description:
        'Добавляет новый блок контента на страницу — в конец страницы (без parentId) или ВНУТРЬ уже существующего блока-контейнера (с parentId). ' +
        'Вызови get_block_schema (без аргументов — список всех типов по категориям, с blockType — точные поля и defaultProps одного типа) ПЕРЕД первым использованием этого инструмента и каждый раз, когда нужен тип, чьи поля ты не помнишь. ' +
        'Структурные блоки для раскладки: section (полноширинная секция), container (более узкая колонка контента внутри секции), columns (ряд/сетка — принимает ТОЛЬКО детей типа column), column (одна колонка внутри columns). ' +
        'Как собрать многоколоночную раскладку/сайдбар: 1) add_block section без parentId, 2) add_block columns с parentId=id секции, 3) add_block column дважды с parentId=id columns, 4) set_style на columns — display:"flex", direction:"row" (или сеткой — display:"grid", gridColumns), 5) добавляй контент с parentId=id нужной колонки. ' +
        'Для сайдбара: у первой колонки set_style grow:"fixed", fixedWidth:280, sticky:true — у второй просто grow:"grow" (по умолчанию). ' +
        'Блоки productgrid/servicegrid/bloggrid требуют включённой у бизнеса соответствующей капабилити (commerce/booking/content) — иначе вызов вернёт понятную ошибку, не создавай их вслепую, если не уверен, что капабилити включена.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'id страницы, куда добавить блок' },
          parentId: {
            type: 'string',
            description:
              'Необязательно — id УЖЕ существующего блока-контейнера (section/container/columns/column) на этой же странице. Если передан, новый блок добавляется в его children, а не в конец страницы.',
          },
          blockType: {
            type: 'string',
            description:
              'Тип блока — см. get_block_schema за точным списком и полями каждого типа.',
            enum: ALLOWED_BLOCK_TYPES,
          },
          props: {
            type: 'object',
            description:
              'Свойства блока (необязательны — каждое поле, которое не передано, берёт значение по умолчанию из get_block_schema). Точный список полей и их типы — вызови get_block_schema с этим blockType. ' +
              'LinkTarget (поля вида control:"linkTarget") — объект {type, ...}: {type:"external",url}, {type:"page",pageId}, {type:"anchor",anchor}, {type:"phone",phone}, {type:"email",email}, {type:"addToCart",productId}, {type:"bookAppointment",serviceId}.',
          },
        },
        required: ['pageId', 'blockType'],
      },
      parseInput: (raw): AddBlockInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { pageId, blockType, props, parentId } = raw as Record<string, unknown>;

        if (typeof pageId !== 'string' || pageId.trim().length === 0) {
          throw new Error('pageId обязателен и должен быть непустой строкой');
        }
        if (typeof blockType !== 'string' || !isAllowedBlockType(blockType)) {
          throw new Error(`blockType должен быть одним из: ${ALLOWED_BLOCK_TYPES.join(', ')}`);
        }
        if (props !== undefined && (typeof props !== 'object' || props === null)) {
          throw new Error('props, если передан, должен быть объектом');
        }
        if (
          parentId !== undefined &&
          (typeof parentId !== 'string' || parentId.trim().length === 0)
        ) {
          throw new Error('parentId, если передан, должен быть непустой строкой');
        }

        return {
          pageId,
          blockType,
          props: (props as Record<string, unknown>) ?? {},
          parentId,
        };
      },
      handler: async (input, ctx: ToolContext): Promise<AddBlockOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const page = draft.document.pages.find((candidate) => candidate.id === input.pageId);
        if (!page) {
          throw new Error(`Страница с id "${input.pageId}" не найдена на этом сайте`);
        }

        // Родитель (если указан) обязан лежать НА ЭТОЙ ЖЕ странице, быть
        // контейнерным типом (`section`/`container`/`columns`/`column` — не
        // любым допустимым типом, `heading`/`text`/т.п. не читают `children`
        // ни в одном рендерере) и, для `columns`, принимать только `column`
        // (`ALLOWED_CHILDREN`) — тот же контракт, что и у ручного билдера.
        let parent: WebsiteBlock | undefined;
        if (input.parentId) {
          const found = findBlockInPages(draft.document.pages, input.parentId);
          if (!found || found.page.id !== page.id) {
            throw new Error(`Блок-родитель с id "${input.parentId}" не найден на этой странице`);
          }
          if (
            !isAllowedBlockType(found.block.type) ||
            !CONTAINER_BLOCK_TYPES.has(found.block.type)
          ) {
            throw new Error(
              `Блок "${input.parentId}" не может содержать вложенные блоки (не контейнер)`,
            );
          }
          const allowedChildren = ALLOWED_CHILDREN[found.block.type];
          if (allowedChildren && !allowedChildren.has(input.blockType)) {
            throw new Error(
              `Блок "${found.block.type}" принимает только детей типа: ${[...allowedChildren].join(', ')}`,
            );
          }
          parent = found.block;
        }

        const schema = BLOCK_SCHEMAS[input.blockType];

        // Тот же гейт, что и у ручного добавления блока (`ComponentLibraryPanel`
        // на frontend фильтрует список именно по этому полю) — только здесь он
        // РЕАЛЬНО проверяется (не просто прячет пункт в списке), потому что AI,
        // в отличие от человека, не увидит, что пункта нет: без явной проверки
        // модель создала бы productgrid/servicegrid/bloggrid на бизнесе без
        // нужной капабилити и уверенно доложила бы об успехе, хотя блок навсегда
        // остался бы пустым (владелец не может добавить товары/услуги/посты без
        // включённой капабилити). Уже РАЗМЕЩЁННый блок продолжает работать даже
        // если капабилити потом выключили — гейт только на создании.
        if (schema.capability) {
          const business = await this.prisma.business.findUnique({
            where: { id: ctx.businessId },
            select: { capabilities: true },
          });
          if (!business?.capabilities.includes(schema.capability)) {
            throw new Error(
              `Блок "${schema.label}" требует включённой капабилити "${schema.capability}" — у этого бизнеса она не включена, блок останется пустым. Включите капабилити в настройках бизнеса или используйте другой тип блока.`,
            );
          }
        }

        const refs: BuildValidatedPropsRefs | undefined = needsBlockRefs(input.blockType)
          ? await buildBlockRefs(
              this.prisma,
              this.mediaAssetsService,
              ctx.businessId,
              ctx.actorId,
              draft.document.pages,
            )
          : undefined;
        const props = buildValidatedProps(schema, input.props, undefined, refs);

        const newBlock: WebsiteBlock = { id: randomUUID(), type: input.blockType, props };

        const updatedPages: WebsitePage[] = parent
          ? replaceBlockInPages(draft.document.pages, parent.id, (block) => ({
              ...block,
              children: [...(block.children ?? []), newBlock],
            }))
          : draft.document.pages.map((candidate) =>
              candidate.id === page.id
                ? { ...candidate, blocks: [...candidate.blocks, newBlock] }
                : candidate,
            );

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return { pageId: page.id, blockId: newBlock.id, blockType: input.blockType };
      },
    };

    this.toolRegistry.register(definition);
  }
}
