import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { buildValidatedStyle, STYLE_FIELD_KEYS } from './lib/block-style-schema';
import { findBlockInPages, replaceBlockInPages } from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Третий записывающий AI-инструмент (AI_PLATFORM_ROADMAP.md, фаза AI-2).
 * В отличие от `add_block`/`update_block_props`, работает на блоке ЛЮБОГО
 * типа — `style` структурно одинаков у каждого блока (`BlockStyle`, см.
 * `lib/block-style-schema.ts`), поэтому не нужен per-type allowlist. Ищет
 * блок рекурсивно по всему дереву документа (см. `lib/block-tree.ts`) — не
 * только среди блоков верхнего уровня страницы.
 */

interface SetStyleInput {
  blockId: string;
  style: Record<string, unknown>;
}

interface SetStyleOutput {
  pageId: string;
  blockId: string;
  style: Record<string, unknown>;
}

@Injectable()
export class SetStyleTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<SetStyleInput, SetStyleOutput> = {
      name: 'set_style',
      description:
        'Меняет оформление (отступы, фон, выравнивание, ширину) УЖЕ СУЩЕСТВУЮЩЕГО блока по его id — ' +
        'работает на любом типе блока. Передавай только те поля style, которые нужно изменить: остальные ' +
        'не тронутся. Значение null у поля убирает его (возврат к оформлению по умолчанию).',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id блока, который нужно оформить' },
          style: {
            type: 'object',
            description:
              `Поля: background(none|surface|muted|primary|dark|custom), customBackgroundColor(hex вида #rrggbb — ` +
              `только когда background="custom", иначе игнорируется), paddingY/paddingX/marginTop/marginBottom(none|sm|md|lg|xl), ` +
              `textAlign(left|center|right), maxWidth(narrow|default|wide|full). Допустимые ключи: ${STYLE_FIELD_KEYS.join(', ')}.`,
          },
        },
        required: ['blockId', 'style'],
      },
      parseInput: (raw): SetStyleInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockId, style } = raw as Record<string, unknown>;

        if (typeof blockId !== 'string' || blockId.trim().length === 0) {
          throw new Error('blockId обязателен и должен быть непустой строкой');
        }
        if (typeof style !== 'object' || style === null) {
          throw new Error('style обязателен и должен быть объектом');
        }
        if (Object.keys(style).length === 0) {
          throw new Error('style должен содержать хотя бы одно поле для изменения');
        }

        return { blockId, style: style as Record<string, unknown> };
      },
      handler: async (input, ctx: ToolContext): Promise<SetStyleOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const found = findBlockInPages(draft.document.pages, input.blockId);
        if (!found) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }

        const newStyle = buildValidatedStyle(found.block.style, input.style);

        const updatedPages = replaceBlockInPages(draft.document.pages, input.blockId, (block) => ({
          ...block,
          style: newStyle,
        }));

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return { pageId: found.page.id, blockId: input.blockId, style: newStyle };
      },
    };

    this.toolRegistry.register(definition);
  }
}
