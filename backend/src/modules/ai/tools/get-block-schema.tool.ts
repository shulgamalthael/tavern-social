import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ToolDefinition } from '../ai.types';
import { ALLOWED_BLOCK_TYPES, BLOCK_SCHEMAS, isAllowedBlockType } from './lib/add-block-schemas';
import { ToolRegistryService } from './tool-registry.service';

interface GetBlockSchemaInput {
  blockType?: string;
}

interface BlockSummary {
  type: string;
  label: string;
  category: string;
  capability?: string;
}

interface BlockSchemaDetail extends BlockSummary {
  fields: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
}

type GetBlockSchemaOutput = { types: BlockSummary[] } | { type: BlockSchemaDetail };

/**
 * Read-only introspection инструмент (в паре с `get_project_tree`/
 * `get_page_blocks`/`get_block`) — единственный источник истины о том, какие
 * поля принимает каждый тип блока в `add_block`/`update_block_props`
 * (`BLOCK_SCHEMAS`, `add-block-schemas.ts`), тот же массив данных, что
 * реально проверяет `buildValidatedProps` — модель узнаёт РОВНО то, что
 * потом провалидируется, не приблизительное описание из текста.
 *
 * Заменяет собой то, что раньше жило прямо в описании `add_block` построчно
 * на каждый тип блока — при 7 типах это было терпимо, при полном allowlist
 * (~45 типов) раздуло бы описание инструмента до нечитаемого размера и
 * держало бы два источника истины (текст описания и сам валидатор) в ручной
 * синхронизации. Без `blockType` — компактный список (тип/лейбл/категория/
 * капабилити) для выбора подходящего типа; с `blockType` — точные поля
 * ОДНОГО типа для реального вызова `add_block`.
 */
@Injectable()
export class GetBlockSchemaTool implements OnModuleInit {
  constructor(private readonly toolRegistry: ToolRegistryService) {}

  onModuleInit(): void {
    const definition: ToolDefinition<GetBlockSchemaInput, GetBlockSchemaOutput> = {
      name: 'get_block_schema',
      description:
        'Возвращает схему допустимых типов блоков для add_block/update_block_props. Без blockType — список ВСЕХ типов (тип, название, категория, нужная капабилити) — используй, чтобы выбрать подходящий тип. С blockType — точные поля этого типа (kind каждого поля, допустимые значения enum, границы чисел, форма элементов списка) и defaultProps — используй ПЕРЕД add_block/update_block_props с этим типом, если не уверен в его полях.',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          blockType: {
            type: 'string',
            description: 'Необязательно — тип блока, чью схему нужно получить целиком.',
            enum: ALLOWED_BLOCK_TYPES,
          },
        },
        required: [],
      },
      parseInput: (raw): GetBlockSchemaInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockType } = raw as Record<string, unknown>;
        if (blockType !== undefined && typeof blockType !== 'string') {
          throw new Error('blockType, если передан, должен быть строкой');
        }
        return { blockType };
      },
      // Чистое чтение статической структуры (`BLOCK_SCHEMAS`), не документа
      // сайта — не нуждается ни в `businessId`, ни в обращении к
      // `WebsitesService`, поэтому без `async`/`await` (`Promise.resolve`
      // только чтобы совпасть с сигнатурой `ToolDefinition.handler`).
      handler: (input): Promise<GetBlockSchemaOutput> => {
        if (input.blockType) {
          if (!isAllowedBlockType(input.blockType)) {
            throw new Error(`Неизвестный тип блока: ${input.blockType}`);
          }
          const schema = BLOCK_SCHEMAS[input.blockType];
          return Promise.resolve({
            type: {
              type: input.blockType,
              label: schema.label,
              category: schema.category,
              capability: schema.capability,
              fields: schema.fields,
              defaultProps: schema.defaultProps,
            },
          });
        }

        return Promise.resolve({
          types: ALLOWED_BLOCK_TYPES.map((type) => {
            const schema = BLOCK_SCHEMAS[type];
            return {
              type,
              label: schema.label,
              category: schema.category,
              capability: schema.capability,
            };
          }),
        });
      },
    };

    this.toolRegistry.register(definition);
  }
}
