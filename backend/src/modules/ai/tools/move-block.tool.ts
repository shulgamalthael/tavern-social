import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import {
  ALLOWED_CHILDREN,
  CONTAINER_BLOCK_TYPES,
  isAllowedBlockType,
} from './lib/add-block-schemas';
import {
  findBlockInPages,
  findParentIdInBlocks,
  insertBlockIntoPage,
  isBlockOrDescendant,
  removeBlockFromPages,
} from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Второй структурный AI-инструмент этой итерации, наравне с `delete_block`
 * (AI_PLATFORM_ROADMAP.md §41.2) — переставляет блок на новую позицию
 * (реордер среди тех же соседей) и/или переносит его в другой контейнер.
 * `medium`, не `high`: в отличие от `delete_block`, ничего не теряется —
 * тот же класс обратимости, что у `set_style`/`update_block_props`
 * (что-то на сайте меняется, но исходные данные блока целы, следующий вызов
 * может переставить его обратно).
 *
 * `parentId` не передан → блок остаётся у ТЕКУЩЕГО родителя, меняется
 * только `index` среди тех же соседей (самый частый случай: «подними этот
 * блок выше» не должен требовать от модели знать/угадывать id контейнера).
 * `toTopLevel: true` — явный перенос на верхний уровень страницы, ИЗ любого
 * контейнера (отдельный флаг, а не `parentId: null` — JSON Schema для
 * function calling здесь не различает «поле не передано» и «поле равно
 * null», см. `JsonSchemaProperty` в `ai.types.ts`; булев флаг однозначен).
 *
 * Перенос в контейнер, который сам лежит ВНУТРИ перемещаемого блока (или
 * это он сам), — реальная ловушка, не гипотетическая: `insertBlockIntoPage`
 * ищет `parentId` УЖЕ ПОСЛЕ того, как `removeBlockFromPages` вырезал
 * перемещаемое поддерево целиком, так что цели внутри этого поддерева к
 * моменту вставки больше не существует. Без явной проверки (см.
 * `isBlockOrDescendant` ниже) это была бы не заметная ошибка, а тихая
 * потеря блока — тот же класс бага, независимо найденный и в frontend-
 * версии `moveBlock` (`entities/website/model/block-tree.ts`) и исправленный
 * там тем же приёмом в этой же итерации.
 */

interface MoveBlockInput {
  blockId: string;
  /** id нового блока-контейнера на той же странице — если не передан,
   * блок остаётся у своего текущего родителя (или на верхнем уровне
   * страницы, если он уже там), меняется только позиция среди соседей. */
  parentId?: string;
  /** Явный перенос на верхний уровень страницы, из любого контейнера.
   * Несовместим с `parentId` (взаимоисключающе). */
  toTopLevel?: boolean;
  /** Позиция среди соседей в месте назначения, отсчёт с 0 — обрезается к
   * границам массива (большое число — безопасный способ сказать «в конец»). */
  index: number;
}

interface MoveBlockOutput {
  pageId: string;
  blockId: string;
  parentId: string | null;
  index: number;
}

@Injectable()
export class MoveBlockTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<MoveBlockInput, MoveBlockOutput> = {
      name: 'move_block',
      description:
        'Переставляет уже существующий блок на новую позицию — среди тех же соседей и/или в другой блок-контейнер (section/container/columns/column). ' +
        'Не передавай parentId, если просто нужно переставить блок среди его текущих соседей (поднять/опустить) — так не нужно знать id родителя. ' +
        'Передай parentId, чтобы перенести блок ВНУТРЬ другого контейнера на той же странице (тот же тип-гейт, что у add_block: columns принимает только column). ' +
        'Передай toTopLevel:true, чтобы вынести блок из любого контейнера на верхний уровень страницы (нельзя вместе с parentId). ' +
        'index — позиция среди соседей в месте назначения, с 0; большое число безопасно значит "в конец".',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id блока, который нужно переместить' },
          parentId: {
            type: 'string',
            description:
              'Необязательно — id блока-контейнера на той же странице, куда перенести блок. Не передавай, чтобы оставить у текущего родителя.',
          },
          toTopLevel: {
            type: 'boolean',
            description:
              'Необязательно — true, чтобы вынести блок из контейнера на верхний уровень страницы. Несовместимо с parentId.',
          },
          index: {
            type: 'integer',
            description: 'Позиция среди соседей в месте назначения, с 0',
          },
        },
        required: ['blockId', 'index'],
      },
      parseInput: (raw): MoveBlockInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockId, parentId, toTopLevel, index } = raw as Record<string, unknown>;

        if (typeof blockId !== 'string' || blockId.trim().length === 0) {
          throw new Error('blockId обязателен и должен быть непустой строкой');
        }
        if (
          parentId !== undefined &&
          (typeof parentId !== 'string' || parentId.trim().length === 0)
        ) {
          throw new Error('parentId, если передан, должен быть непустой строкой');
        }
        if (toTopLevel !== undefined && typeof toTopLevel !== 'boolean') {
          throw new Error('toTopLevel, если передан, должен быть true или false');
        }
        if (parentId !== undefined && toTopLevel) {
          throw new Error('нельзя одновременно передать parentId и toTopLevel:true');
        }
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
          throw new Error('index обязателен и должен быть целым числом от 0');
        }

        return { blockId, parentId, toTopLevel, index };
      },
      handler: async (input, ctx: ToolContext): Promise<MoveBlockOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const found = findBlockInPages(draft.document.pages, input.blockId);
        if (!found) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }

        let targetParentId: string | null;
        if (input.toTopLevel) {
          targetParentId = null;
        } else if (input.parentId !== undefined) {
          targetParentId = input.parentId;
        } else {
          const currentParentId = findParentIdInBlocks(found.page.blocks, input.blockId);
          targetParentId = currentParentId ?? null;
        }

        if (targetParentId !== null) {
          if (isBlockOrDescendant(found.block, targetParentId)) {
            throw new Error(
              'нельзя переместить блок внутрь самого себя или своего собственного дочернего блока',
            );
          }
          const target = findBlockInPages(draft.document.pages, targetParentId);
          if (!target || target.page.id !== found.page.id) {
            throw new Error(`Блок-контейнер с id "${targetParentId}" не найден на этой странице`);
          }
          if (
            !isAllowedBlockType(target.block.type) ||
            !CONTAINER_BLOCK_TYPES.has(target.block.type)
          ) {
            throw new Error(
              `Блок "${targetParentId}" не может содержать вложенные блоки (не контейнер)`,
            );
          }
          const allowedChildren = ALLOWED_CHILDREN[target.block.type];
          if (
            allowedChildren &&
            (!isAllowedBlockType(found.block.type) || !allowedChildren.has(found.block.type))
          ) {
            throw new Error(
              `Блок "${target.block.type}" принимает только детей типа: ${[...allowedChildren].join(', ')}`,
            );
          }
        }

        const { pages: withoutBlock, removed } = removeBlockFromPages(
          draft.document.pages,
          input.blockId,
        );
        if (!removed) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }
        const updatedPages = insertBlockIntoPage(
          withoutBlock,
          found.page.id,
          removed,
          targetParentId,
          input.index,
        );

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return {
          pageId: found.page.id,
          blockId: input.blockId,
          parentId: targetParentId,
          index: input.index,
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
