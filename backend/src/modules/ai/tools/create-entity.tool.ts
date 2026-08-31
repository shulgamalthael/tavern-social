import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CustomEntitiesService } from '@/modules/custom-entities/custom-entities.service';
import { CUSTOM_ENTITY_FIELD_TYPES } from '@/modules/custom-entities/lib/custom-entity-schema.lib';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

/**
 * AI-8 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.2/§19) — тонкая
 * обёртка вокруг уже существующего `CustomEntitiesService.createEntity`, не
 * новый write-путь (тот же принцип, что `CreateCustomWidgetTool`). Реальная
 * валидация полей (уникальность key, допустимый type) — в
 * `parseEntityFields`, вызываемой сервисом, не дублируется здесь.
 * `medium` risk — создаёт новую схему данных (обратимо: владелец может
 * удалить сущность через дашборд).
 */

interface CreateEntityInput {
  name: string;
  fields: Array<{ key: string; label: string; type: string; required?: boolean }>;
}

interface CreateEntityOutput {
  entityId: string;
  name: string;
  fieldCount: number;
}

@Injectable()
export class CreateEntityTool implements OnModuleInit {
  constructor(
    private readonly customEntitiesService: CustomEntitiesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<CreateEntityInput, CreateEntityOutput> = {
      name: 'create_entity',
      description:
        'Создаёт новую пользовательскую сущность (например "Клиенты CRM", "Заявки на ремонт") с начальным набором полей — маленькую собственную "таблицу" бизнеса за пределами Товаров/Услуг/Заказов. ' +
        `Каждое поле — { key, label, type, required? }, где key — идентификатор (латиница/цифры/_, начинается с буквы), type — один из: ${CUSTOM_ENTITY_FIELD_TYPES.join(', ')}. ` +
        'После создания поля можно только добавлять (add_field), не удалять и не переименовывать.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название сущности, например "Клиенты CRM"' },
          fields: {
            type: 'array',
            description: 'Непустой список полей: [{ key, label, type, required? }, ...]',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Например customerName' },
                label: { type: 'string', description: 'Человекочитаемое название поля' },
                type: { type: 'string', enum: [...CUSTOM_ENTITY_FIELD_TYPES] },
                required: { type: 'boolean' },
              },
              required: ['key', 'label', 'type'],
            },
          },
        },
        required: ['name', 'fields'],
      },
      parseInput: (raw): CreateEntityInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { name, fields } = raw as Record<string, unknown>;

        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('name обязателен и должен быть непустой строкой');
        }
        if (!Array.isArray(fields) || fields.length === 0) {
          throw new Error('fields обязателен и должен быть непустым массивом полей');
        }

        return { name: name.trim(), fields: fields as CreateEntityInput['fields'] };
      },
      handler: async (input, ctx: ToolContext): Promise<CreateEntityOutput> => {
        const entity = await this.customEntitiesService.createEntity(ctx.businessId, ctx.actorId, {
          name: input.name,
          fields: input.fields,
        });
        return { entityId: entity.id, name: entity.name, fieldCount: entity.fields.length };
      },
    };

    this.toolRegistry.register(definition);
  }
}
