import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CustomWidgetsService } from '@/modules/custom-widgets/custom-widgets.service';
import type { CustomWidgetDto } from '@/modules/custom-widgets/custom-widgets.types';
import { ALLOWED_BLOCK_TYPES } from './lib/add-block-schemas';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

/**
 * AI-6's first AI-authoring entry point (AI_PLATFORM_ROADMAP.md §14/§16.1)
 * — the Custom Widget Engine (§14) shipped API-only (owner CRUD, no AI tool),
 * same "prove storage/validation first" precedent as AI-5's `Rule` engine.
 * This tool is a thin wrapper around the *existing* `CustomWidgetsService.
 * create`, not a new write path: `parseInput` here only checks the outer
 * shape (name is a string, schema is a non-empty array of plain objects) —
 * the real per-block validation (allowed `blockType`, `props` shape) is the
 * SAME `parseWidgetSchema`/`add-block-schemas.ts` allowlist `add_block`
 * already uses, enforced inside `CustomWidgetsService.create` itself, not
 * duplicated here (same "tool layer is a new caller of old code" principle,
 * §1). A widget created this way is a `draft`-status `CustomWidget` row,
 * indistinguishable from one created through the owner-only REST API —
 * still not embeddable on any page yet (§14/§16.2's own scope boundary).
 */

interface CreateCustomWidgetInput {
  name: string;
  schema: Array<{ blockType: string; props?: Record<string, unknown> }>;
}

interface CreateCustomWidgetOutput {
  widgetId: string;
  name: string;
  blockCount: number;
}

@Injectable()
export class CreateCustomWidgetTool implements OnModuleInit {
  constructor(
    private readonly customWidgetsService: CustomWidgetsService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<CreateCustomWidgetInput, CreateCustomWidgetOutput> = {
      name: 'create_custom_widget',
      description:
        'Сохраняет именованную, переиспользуемую композицию блоков как виджет (пока НЕ встраивается ни в одну страницу — это заготовка на будущее). ' +
        `Каждый элемент schema — это { blockType, props? }, где blockType — один из: ${ALLOWED_BLOCK_TYPES.join(', ')} (те же типы, что у add_block). ` +
        'Полезно, когда владелец просит подготовить один и тот же набор блоков заранее для повторного использования.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название виджета, например "Блок с адресом"' },
          schema: {
            type: 'array',
            description: 'Непустой список блоков виджета: [{ blockType, props? }, ...]',
          },
        },
        required: ['name', 'schema'],
      },
      parseInput: (raw): CreateCustomWidgetInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { name, schema } = raw as Record<string, unknown>;

        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('name обязателен и должен быть непустой строкой');
        }
        if (!Array.isArray(schema) || schema.length === 0) {
          throw new Error('schema обязателен и должен быть непустым массивом блоков');
        }
        for (const [index, item] of schema.entries()) {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            throw new Error(`schema[${index}] должен быть объектом`);
          }
        }

        return {
          name: name.trim(),
          schema: schema as CreateCustomWidgetInput['schema'],
        };
      },
      handler: async (input, ctx: ToolContext): Promise<CreateCustomWidgetOutput> => {
        const widget: CustomWidgetDto = await this.customWidgetsService.create(
          ctx.businessId,
          ctx.actorId,
          { name: input.name, schema: input.schema },
        );
        return { widgetId: widget.id, name: widget.name, blockCount: widget.schema.length };
      },
    };

    this.toolRegistry.register(definition);
  }
}
