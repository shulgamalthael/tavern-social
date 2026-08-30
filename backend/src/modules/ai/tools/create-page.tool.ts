import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { slugify } from '@/modules/businesses/lib/slugify';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

interface CreatePageInput {
  title: string;
}

interface CreatePageOutput {
  pageId: string;
  slug: string;
  title: string;
}

const MAX_TITLE_LENGTH = 200;

/**
 * Первый ЗАПИСЫВАЮЩИЙ AI-инструмент проекта (AI_PLATFORM_ROADMAP.md, фаза
 * AI-2) — доказывает пайп «чат → intent → tool call → validated write» без
 * упора в §3 (валидация `props`/`style` блоков против `BlockDefinition.
 * fields`), потому что новая страница создаётся с `blocks: []` — валидировать
 * нечего, это осознанно узкий первый срез записи, а не обход §3. Остальные
 * инструменты фазы AI-2 (`update_block_props`, `set_style`, `add_block`)
 * реально трогают форму блока и потому ждут переносимой на backend
 * схемы-валидатора — см. AI_PLATFORM_ROADMAP.md §3/§4.
 *
 * `medium`, не `low`: в отличие от `get_project_tree` это настоящая мутация
 * персистентных данных бизнеса (мнение AiService сегодня не различает
 * `low`/`medium` исполнением — оба выполняются сразу, разница только в
 * audit-логе; подтверждение перед выполнением зарезервировано под `high`/
 * `critical`, см. AI_PLATFORM_ROADMAP.md §2.8/фаза AI-9).
 */
@Injectable()
export class CreatePageTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<CreatePageInput, CreatePageOutput> = {
      name: 'create_page',
      description:
        'Создаёт новую пустую страницу сайта с заданным заголовком (без блоков контента — их нужно будет добавить отдельно, этот инструмент пока не умеет). Slug страницы формируется автоматически из заголовка.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Заголовок новой страницы, например "О нас"',
          },
        },
        required: ['title'],
      },
      parseInput: (raw): CreatePageInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const title = (raw as Record<string, unknown>).title;
        if (typeof title !== 'string' || title.trim().length === 0) {
          throw new Error('title обязателен и должен быть непустой строкой');
        }
        const trimmed = title.trim();
        if (trimmed.length > MAX_TITLE_LENGTH) {
          throw new Error(`title не может быть длиннее ${MAX_TITLE_LENGTH} символов`);
        }
        return { title: trimmed };
      },
      handler: async (input, ctx: ToolContext): Promise<CreatePageOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const existingSlugs = new Set(draft.document.pages.map((page) => page.slug));

        const base = slugify(input.title);
        let slug = base;
        for (let attempt = 2; existingSlugs.has(slug); attempt += 1) {
          slug = `${base}-${attempt}`;
        }

        const newPage = {
          id: randomUUID(),
          slug,
          title: input.title,
          blocks: [],
          seoTitle: null,
          seoDescription: null,
          ogImage: null,
        };

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: [...draft.document.pages, newPage],
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return { pageId: newPage.id, slug: newPage.slug, title: newPage.title };
      },
    };

    this.toolRegistry.register(definition);
  }
}
