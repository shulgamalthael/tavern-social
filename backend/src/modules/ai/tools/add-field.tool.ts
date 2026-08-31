import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CustomEntitiesService } from '@/modules/custom-entities/custom-entities.service';
import { CUSTOM_ENTITY_FIELD_TYPES } from '@/modules/custom-entities/lib/custom-entity-schema.lib';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

/**
 * AI-8 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.2/§19) —
 * дополняет уже существующую сущность РОВНО одним новым полем через
 * `CustomEntitiesService.addField` (`appendField` внутри неё гарантирует
 * additive-only: уникальность key, лимит полей). Модель должна сначала
 * вызвать `list_entities`, чтобы узнать `entityId` — этот инструмент
 * намеренно не принимает имя сущности вместо id (искать по имени —
 * неоднозначно, если владелец создал две сущности с похожим названием).
 * `medium` risk — меняет существующую схему данных (обратимо только
 * добавлением, само поле убрать нельзя, поэтому это не "low").
 */

interface AddFieldInput {
  entityId: string;
  field: { key: string; label: string; type: string; required?: boolean };
}

interface AddFieldOutput {
  entityId: string;
  fieldCount: number;
}

@Injectable()
export class AddFieldTool implements OnModuleInit {
  constructor(
    private readonly customEntitiesService: CustomEntitiesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<AddFieldInput, AddFieldOutput> = {
      name: 'add_field',
      description:
        'Добавляет ОДНО новое поле к уже существующей пользовательской сущности (entityId — из list_entities). Поля можно только добавлять, не удалять и не переименовывать существующие.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'id сущности из list_entities' },
          field: {
            type: 'object',
            description: 'Новое поле: { key, label, type, required? }',
            properties: {
              key: { type: 'string', description: 'Например notes — ещё не занят на сущности' },
              label: { type: 'string' },
              type: { type: 'string', enum: [...CUSTOM_ENTITY_FIELD_TYPES] },
              required: { type: 'boolean' },
            },
            required: ['key', 'label', 'type'],
          },
        },
        required: ['entityId', 'field'],
      },
      parseInput: (raw): AddFieldInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { entityId, field } = raw as Record<string, unknown>;

        if (typeof entityId !== 'string' || entityId.trim().length === 0) {
          throw new Error('entityId обязателен и должен быть непустой строкой');
        }
        if (typeof field !== 'object' || field === null || Array.isArray(field)) {
          throw new Error('field обязателен и должен быть объектом');
        }

        return { entityId, field: field as AddFieldInput['field'] };
      },
      handler: async (input, ctx: ToolContext): Promise<AddFieldOutput> => {
        const entity = await this.customEntitiesService.addField(
          ctx.businessId,
          input.entityId,
          ctx.actorId,
          { field: input.field },
        );
        return { entityId: entity.id, fieldCount: entity.fields.length };
      },
    };

    this.toolRegistry.register(definition);
  }
}
