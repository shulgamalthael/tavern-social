import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { findBlockInPages } from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

interface GetBlockInput {
  blockId: string;
}

interface GetBlockOutput {
  pageId: string;
  block: {
    id: string;
    type: string;
    props: Record<string, unknown>;
    style: Record<string, unknown>;
    hidden: Record<string, unknown>;
    hasChildren: boolean;
  };
}

/**
 * Третий introspection-инструмент (после `get_project_tree`/
 * `get_page_blocks`, AI_PLATFORM_ROADMAP.md §34) — полное текущее состояние
 * ОДНОГО блока по id: реальные `props`/`style`/`hidden`, а не то, что модель
 * помнит из своего же более раннего `add_block` в этом же разговоре (память
 * диалога может не совпадать с фактическим состоянием — например, если
 * пользователь сам поправил блок в визуальном конструкторе между сообщениями
 * чата). Ищет блок рекурсивно по всему дереву документа (`findBlockInPages`
 * — та же утилита, что уже используют `set_style`/`update_block_props`), не
 * только среди блоков верхнего уровня страницы.
 */
@Injectable()
export class GetBlockTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<GetBlockInput, GetBlockOutput> = {
      name: 'get_block',
      description:
        'Возвращает текущие props и style одного блока по id — вызови перед update_block_props/set_style, чтобы менять блок точечно на основе его РЕАЛЬНОГО текущего состояния, а не перезаписывать вслепую. id блоков — из get_project_tree/get_page_blocks.',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id блока' },
        },
        required: ['blockId'],
      },
      parseInput: (raw): GetBlockInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockId } = raw as Record<string, unknown>;
        if (typeof blockId !== 'string' || blockId.trim().length === 0) {
          throw new Error('blockId обязателен и должен быть непустой строкой');
        }
        return { blockId };
      },
      handler: async (input, ctx: ToolContext): Promise<GetBlockOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const found = findBlockInPages(draft.document.pages, input.blockId);
        if (!found) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }
        return {
          pageId: found.page.id,
          block: {
            id: found.block.id,
            type: found.block.type,
            props: found.block.props,
            style: found.block.style ?? {},
            hidden: found.block.hidden ?? {},
            hasChildren: Boolean(found.block.children && found.block.children.length > 0),
          },
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
