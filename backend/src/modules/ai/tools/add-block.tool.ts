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
  BLOCK_SCHEMAS,
  buildValidatedProps,
  isAllowedBlockType,
  type AllowedBlockType,
  type BuildValidatedPropsRefs,
} from './lib/add-block-schemas';
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
 * (см. `lib/link-target-schema.ts`). `productgrid`/`gallery`/data-bound
 * блоки по-прежнему НЕ поддержаны — те требуют `control: 'dataSource'`,
 * структурно другой формы, чем `LinkTarget`.
 */

interface AddBlockInput {
  pageId: string;
  blockType: AllowedBlockType;
  props: Record<string, unknown>;
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
        'Добавляет новый блок контента в КОНЕЦ указанной страницы (сначала узнай id страницы через get_project_tree). ' +
        'Поддерживает: heading (заголовок), text (абзац), quote (цитата), spacer (пустой отступ), image (изображение — src только из list_media_assets), button (кнопка со ссылкой). ' +
        'Для остальных типов блоков (галереи, товарные сетки и т.п.) инструмента пока нет.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'id страницы, куда добавить блок' },
          blockType: {
            type: 'string',
            description: 'Тип блока',
            enum: ALLOWED_BLOCK_TYPES,
          },
          props: {
            type: 'object',
            description:
              'Свойства блока (необязательны — каждое поле, которое не передано, берёт разумное значение по умолчанию). ' +
              'heading: text/level(h1|h2|h3)/size(sm|md|lg|xl)/color(default|primary|muted). ' +
              'text: text/color(default|primary|muted). quote: text/author. spacer: height(sm|md|lg|xl). ' +
              'image: src(url из list_media_assets или null)/alt/objectFit(cover|contain)/radius(none|sm|md|lg|full)/width(auto|full)/link(LinkTarget). ' +
              'button: label/url(LinkTarget)/variant(solid|outline|soft)/size(sm|md|lg)/target(_self|_blank). ' +
              'LinkTarget — объект {type, ...}: {type:"external",url}, {type:"page",pageId}, {type:"anchor",anchor}, {type:"phone",phone}, {type:"email",email}, {type:"addToCart",productId}, {type:"bookAppointment",serviceId}.',
          },
        },
        required: ['pageId', 'blockType'],
      },
      parseInput: (raw): AddBlockInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { pageId, blockType, props } = raw as Record<string, unknown>;

        if (typeof pageId !== 'string' || pageId.trim().length === 0) {
          throw new Error('pageId обязателен и должен быть непустой строкой');
        }
        if (typeof blockType !== 'string' || !isAllowedBlockType(blockType)) {
          throw new Error(`blockType должен быть одним из: ${ALLOWED_BLOCK_TYPES.join(', ')}`);
        }
        if (props !== undefined && (typeof props !== 'object' || props === null)) {
          throw new Error('props, если передан, должен быть объектом');
        }

        return { pageId, blockType, props: (props as Record<string, unknown>) ?? {} };
      },
      handler: async (input, ctx: ToolContext): Promise<AddBlockOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const page = draft.document.pages.find((candidate) => candidate.id === input.pageId);
        if (!page) {
          throw new Error(`Страница с id "${input.pageId}" не найдена на этом сайте`);
        }

        const schema = BLOCK_SCHEMAS[input.blockType];
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

        const updatedPages: WebsitePage[] = draft.document.pages.map((candidate) =>
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
