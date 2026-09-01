import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

interface GetPageBlocksInput {
  pageId: string;
}

interface BlockTreeNode {
  id: string;
  type: string;
  hidden?: boolean;
  children?: BlockTreeNode[];
}

interface GetPageBlocksOutput {
  pageId: string;
  blocks: BlockTreeNode[];
}

function toTreeNode(block: WebsiteBlock): BlockTreeNode {
  const node: BlockTreeNode = { id: block.id, type: block.type };
  if (block.hidden && Object.keys(block.hidden).length > 0) node.hidden = true;
  if (block.children && block.children.length > 0) {
    node.children = block.children.map(toTreeNode);
  }
  return node;
}

/**
 * Второй introspection-инструмент проекта, после `get_project_tree`
 * (AI_PLATFORM_ROADMAP.md §34, брифа §15A "Builder Introspection API") —
 * тот отдаёт только список страниц бизнеса (id/slug/title/blockCount), этот
 * — реальное дерево блоков ОДНОЙ страницы: id/type/вложенность, сознательно
 * БЕЗ содержимого и стилей (см. `get_block` рядом — для конкретного блока).
 * Модель обязана вызвать это (или уже иметь id из собственного `add_block` в
 * этом же разговоре), прежде чем звать `update_block_props`/`set_style` на
 * УЖЕ СУЩЕСТВУЮЩЕМ блоке — не придумывать id по памяти диалога (см. брифа
 * §11 "AI не должен... придумывать ID... выполнять изменения без проверки
 * context").
 */
@Injectable()
export class GetPageBlocksTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<GetPageBlocksInput, GetPageBlocksOutput> = {
      name: 'get_page_blocks',
      description:
        'Возвращает дерево блоков одной страницы сайта: id, type и вложенность каждого блока, без содержимого и стилей (для этого — get_block с конкретным id). Вызови перед update_block_props/set_style на существующем блоке, если не знаешь его id.',
      riskLevel: 'low',
      parameters: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'id страницы (из get_project_tree)' },
        },
        required: ['pageId'],
      },
      parseInput: (raw): GetPageBlocksInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { pageId } = raw as Record<string, unknown>;
        if (typeof pageId !== 'string' || pageId.trim().length === 0) {
          throw new Error('pageId обязателен и должен быть непустой строкой');
        }
        return { pageId };
      },
      handler: async (input, ctx: ToolContext): Promise<GetPageBlocksOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const page = draft.document.pages.find((candidate) => candidate.id === input.pageId);
        if (!page) {
          throw new Error(`Страница с id "${input.pageId}" не найдена`);
        }
        return { pageId: page.id, blocks: page.blocks.map(toTreeNode) };
      },
    };

    this.toolRegistry.register(definition);
  }
}
