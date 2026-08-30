import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

type GetProjectTreeInput = Record<string, never>;

interface GetProjectTreePageSummary {
  id: string;
  slug: string;
  title: string;
  blockCount: number;
}

interface GetProjectTreeOutput {
  pages: GetProjectTreePageSummary[];
}

function countBlocks(blocks: WebsiteBlock[]): number {
  return blocks.reduce((total, block) => total + 1 + countBlocks(block.children ?? []), 0);
}

/**
 * Первый AI-инструмент проекта (AI_PLATFORM_ROADMAP.md, фаза AI-1) —
 * доказывает весь pipe (чат → intent → tool call → validated read → ответ)
 * без единой записывающей операции. Read-only через уже существующий
 * `WebsitesService.getDraft` (который сам заново проверяет владение
 * бизнесом — не новый код доступа к данным, а новый вызывающий существующего),
 * поэтому `low` risk — не требует подтверждения перед выполнением (см.
 * `AiService`).
 */
@Injectable()
export class GetProjectTreeTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<GetProjectTreeInput, GetProjectTreeOutput> = {
      name: 'get_project_tree',
      description:
        'Возвращает список страниц текущего сайта бизнеса: id, slug, заголовок и количество блоков на странице. Не принимает аргументов.',
      riskLevel: 'low',
      parameters: { type: 'object', properties: {}, required: [] },
      parseInput: (): GetProjectTreeInput => ({}),
      handler: async (_input, ctx: ToolContext): Promise<GetProjectTreeOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        return {
          pages: draft.document.pages.map((page) => ({
            id: page.id,
            slug: page.slug,
            title: page.title,
            blockCount: countBlocks(page.blocks),
          })),
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
