import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { buildBlockRefs, needsBlockRefs } from './build-block-refs';
import {
  ALLOWED_BLOCK_TYPES,
  BLOCK_SCHEMAS,
  buildValidatedProps,
  isAllowedBlockType,
  type BuildValidatedPropsRefs,
} from './lib/add-block-schemas';
import { findBlockInPages, replaceBlockInPages } from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Четвёртый записывающий AI-инструмент (AI_PLATFORM_ROADMAP.md, фаза AI-2)
 * — последний из четырёх, изначально запланированных для этой фазы (§4/§8
 * роадмапа). В отличие от `set_style`, ограничен тем же curated allowlist
 * типов, что и `add_block` (`lib/add-block-schemas.ts`): `props` — в
 * отличие от `style` — своя форма у каждого типа блока, а backend не может
 * прочитать полный frontend-реестр `BlockDefinition.fields` (§3 роадмапа).
 * Патчит только присланные поля поверх ТЕКУЩИХ `props` найденного блока
 * (`buildValidatedProps(schema, rawProps, existingProps)`), не поверх
 * дефолтов — иначе обновление одного поля тихо сбросило бы остальные.
 */

interface UpdateBlockPropsInput {
  blockId: string;
  props: Record<string, unknown>;
}

interface UpdateBlockPropsOutput {
  pageId: string;
  blockId: string;
  props: Record<string, unknown>;
}

@Injectable()
export class UpdateBlockPropsTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly prisma: PrismaService,
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<UpdateBlockPropsInput, UpdateBlockPropsOutput> = {
      name: 'update_block_props',
      description:
        'Меняет содержимое (текст и другие свойства) УЖЕ СУЩЕСТВУЮЩЕГО блока по его id. ' +
        `Поддерживает только типы блоков из add_block: ${ALLOWED_BLOCK_TYPES.join(', ')}. ` +
        'Передавай только те поля props, которые нужно изменить: остальные не тронутся.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id блока, который нужно изменить' },
          props: {
            type: 'object',
            description:
              'Новые значения полей (см. описание props в add_block для конкретного типа блока).',
          },
        },
        required: ['blockId', 'props'],
      },
      parseInput: (raw): UpdateBlockPropsInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockId, props } = raw as Record<string, unknown>;

        if (typeof blockId !== 'string' || blockId.trim().length === 0) {
          throw new Error('blockId обязателен и должен быть непустой строкой');
        }
        if (typeof props !== 'object' || props === null) {
          throw new Error('props обязателен и должен быть объектом');
        }
        if (Object.keys(props).length === 0) {
          throw new Error('props должен содержать хотя бы одно поле для изменения');
        }

        return { blockId, props: props as Record<string, unknown> };
      },
      handler: async (input, ctx: ToolContext): Promise<UpdateBlockPropsOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const found = findBlockInPages(draft.document.pages, input.blockId);
        if (!found) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }
        if (!isAllowedBlockType(found.block.type)) {
          throw new Error(
            `Обновление props для типа блока "${found.block.type}" пока не поддерживается — доступны только: ${ALLOWED_BLOCK_TYPES.join(', ')}`,
          );
        }

        const schema = BLOCK_SCHEMAS[found.block.type];
        const refs: BuildValidatedPropsRefs | undefined = needsBlockRefs(found.block.type)
          ? await buildBlockRefs(
              this.prisma,
              this.mediaAssetsService,
              ctx.businessId,
              ctx.actorId,
              draft.document.pages,
            )
          : undefined;
        const newProps = buildValidatedProps(schema, input.props, found.block.props, refs);

        const updatedPages = replaceBlockInPages(draft.document.pages, input.blockId, (block) => ({
          ...block,
          props: newProps,
        }));

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return { pageId: found.page.id, blockId: input.blockId, props: newProps };
      },
    };

    this.toolRegistry.register(definition);
  }
}
