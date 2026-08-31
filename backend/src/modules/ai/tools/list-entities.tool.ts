import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CustomEntitiesService } from '@/modules/custom-entities/custom-entities.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

type ListEntitiesInput = Record<string, never>;

interface ListEntitiesOutput {
  entities: Array<{
    entityId: string;
    name: string;
    fields: Array<{ key: string; label: string; type: string; required: boolean }>;
  }>;
}

/**
 * Read-only инструмент (AI_PLATFORM_ROADMAP.md §19, AI-8) — даёт модели
 * увидеть уже созданные сущности и их поля ДО вызова `add_field` (нужно
 * знать `entityId` и уже занятые `key`, чтобы не предложить дубликат), тот
 * же "list before write" приём, что `list_media_assets` для `add_block`.
 * `low` risk — ничего не мутирует.
 */
@Injectable()
export class ListEntitiesTool implements OnModuleInit {
  constructor(
    private readonly customEntitiesService: CustomEntitiesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<ListEntitiesInput, ListEntitiesOutput> = {
      name: 'list_entities',
      description:
        'Возвращает список уже созданных пользовательских сущностей (custom database) бизнеса вместе с их полями. Не принимает аргументов.',
      riskLevel: 'low',
      parameters: { type: 'object', properties: {}, required: [] },
      parseInput: (): ListEntitiesInput => ({}),
      handler: async (_input, ctx: ToolContext): Promise<ListEntitiesOutput> => {
        const entities = await this.customEntitiesService.listEntities(ctx.businessId, ctx.actorId);
        return {
          entities: entities.map((entity) => ({
            entityId: entity.id,
            name: entity.name,
            fields: entity.fields,
          })),
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
