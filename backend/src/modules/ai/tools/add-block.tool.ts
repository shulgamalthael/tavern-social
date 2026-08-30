import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsiteBlock, WebsitePage } from '@/modules/websites/websites.types';
import type { ToolContext, ToolDefinition } from '../ai.types';
import {
  ALLOWED_BLOCK_TYPES,
  BLOCK_SCHEMAS,
  buildValidatedProps,
  isAllowedBlockType,
  type AllowedBlockType,
} from './lib/add-block-schemas';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Второй записывающий AI-инструмент (AI_PLATFORM_ROADMAP.md, фаза AI-2,
 * продолжение после `create_page`, см. §7 роадмапа). Как и было
 * анонсировано там: `update_block_props`/`set_style` откладываются, пока
 * нет переносимого на backend валидатора `BlockDefinition.fields` (§3 —
 * AI-генерируемые `props` — untrusted input, а backend сегодня не может
 * прочитать frontend-реестр напрямую: React-компоненты рендереров туда
 * импортированы, backend их не может резолвить).
 *
 * Вместо переноса ВСЕГО реестра (все 12 категорий, `control: 'link'`/
 * `'dataSource'`/`'list'` с их структурными формами) — узкий allowlist
 * (mission §21 "allowlist > blocklist", уже применённый в этом плане к
 * custom-widget engine, §2.4): 4 самых простых типографических/layout-блока
 * без ссылок, медиа и data-binding — схемы вынесены в `lib/add-block-
 * schemas.ts` (юнит-тестируется отдельно от NestJS-обвязки) и СВЕРЕНЫ
 * построчно с настоящими `defaultProps`/`fields` в
 * `frontend/src/entities/website/blocks/{typography,layout}/index.tsx` —
 * блок, добавленный этим инструментом, открывается в инспекторе билдера
 * точно так же, как если бы его перетащили руками. Остальные типы блоков
 * (`image`/`gallery`/`button`/`productgrid`/...) НЕ поддержаны этим
 * инструментом намеренно, не как временный пробел: `image`/`button` тянут
 * за собой `LinkTarget` (структурный union, не просто строка) и/или
 * загрузку медиа, которых у AI-слоя пока нет вообще — расширять allowlist
 * стоит вместе с появлением соответствующих возможностей, не раньше.
 */

interface AddBlockInput {
  pageId: string;
  blockType: AllowedBlockType;
  props: Record<string, unknown>;
}

interface AddBlockOutput {
  pageId: string;
  blockId: string;
  blockType: AllowedBlockType;
}

@Injectable()
export class AddBlockTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<AddBlockInput, AddBlockOutput> = {
      name: 'add_block',
      description:
        'Добавляет новый блок контента в КОНЕЦ указанной страницы (сначала узнай id страницы через get_project_tree). ' +
        'Поддерживает только простые типы без ссылок и медиа: heading (заголовок), text (абзац), quote (цитата), spacer (пустой отступ). ' +
        'Для остальных типов блоков (изображения, кнопки, товары и т.п.) инструмента пока нет.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'id страницы, куда добавить блок' },
          blockType: {
            type: 'string',
            description: 'Тип блока',
            enum: ALLOWED_BLOCK_TYPES,
          },
          props: {
            type: 'object',
            description:
              'Свойства блока (необязательны — каждое поле, которое не передано, берёт разумное значение по умолчанию). ' +
              'heading: text/level(h1|h2|h3)/size(sm|md|lg|xl)/color(default|primary|muted). ' +
              'text: text/color(default|primary|muted). quote: text/author. spacer: height(sm|md|lg|xl).',
          },
        },
        required: ['pageId', 'blockType'],
      },
      parseInput: (raw): AddBlockInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { pageId, blockType, props } = raw as Record<string, unknown>;

        if (typeof pageId !== 'string' || pageId.trim().length === 0) {
          throw new Error('pageId обязателен и должен быть непустой строкой');
        }
        if (typeof blockType !== 'string' || !isAllowedBlockType(blockType)) {
          throw new Error(`blockType должен быть одним из: ${ALLOWED_BLOCK_TYPES.join(', ')}`);
        }
        if (props !== undefined && (typeof props !== 'object' || props === null)) {
          throw new Error('props, если передан, должен быть объектом');
        }

        return { pageId, blockType, props: (props as Record<string, unknown>) ?? {} };
      },
      handler: async (input, ctx: ToolContext): Promise<AddBlockOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const page = draft.document.pages.find((candidate) => candidate.id === input.pageId);
        if (!page) {
          throw new Error(`Страница с id "${input.pageId}" не найдена на этом сайте`);
        }

        const schema = BLOCK_SCHEMAS[input.blockType];
        const props = buildValidatedProps(schema, input.props);

        const newBlock: WebsiteBlock = { id: randomUUID(), type: input.blockType, props };

        const updatedPages: WebsitePage[] = draft.document.pages.map((candidate) =>
          candidate.id === page.id
            ? { ...candidate, blocks: [...candidate.blocks, newBlock] }
            : candidate,
        );

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return { pageId: page.id, blockId: newBlock.id, blockType: input.blockType };
      },
    };

    this.toolRegistry.register(definition);
  }
}
