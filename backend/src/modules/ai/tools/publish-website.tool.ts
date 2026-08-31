import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

type PublishWebsiteInput = Record<string, never>;

interface PublishWebsiteOutput {
  publishedAt: string;
}

/**
 * AI-9 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.8/§21) — первый
 * реальный `high`-risk инструмент проекта, доказывающий confirm-флоу (до
 * этого ни один инструмент не был `high`/`critical`, см. форвард-комментарий
 * `create-page.tool.ts`). Тонкая обёртка вокруг уже существующего
 * `WebsitesService.publish` — той же операции, что стоит за кнопкой
 * «Опубликовать» в дашборде (`BusinessDashboardWidget.tsx`), не новый
 * write-путь. `high`, не `critical` — делает сайт публично видимым (реальные
 * посетители, реальные заказы/записи могут начать приходить), но не
 * разрушительно необратимо: повторная публикация черновика перезаписывает
 * опубликованную версию (истории версий/отката нет, см. `publish`'s
 * комментарий), но данные при этом не теряются — драфт остаётся драфтом.
 */
@Injectable()
export class PublishWebsiteTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<PublishWebsiteInput, PublishWebsiteOutput> = {
      name: 'publish_website',
      description:
        'Публикует текущий черновик сайта — делает его видимым всем посетителям по реальному адресу бизнеса. Вызови этот инструмент напрямую, когда владелец просит опубликовать сайт — система сама покажет владельцу запрос на подтверждение перед выполнением, отдельно спрашивать разрешение текстом не нужно. Не принимает аргументов.',
      riskLevel: 'high',
      parameters: { type: 'object', properties: {}, required: [] },
      parseInput: (): PublishWebsiteInput => ({}),
      handler: async (_input, ctx: ToolContext): Promise<PublishWebsiteOutput> => {
        const result = await this.websitesService.publish(ctx.businessId, ctx.actorId);
        return { publishedAt: result.updatedAt };
      },
    };

    this.toolRegistry.register(definition);
  }
}
