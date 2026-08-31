import { Injectable, type OnModuleInit } from '@nestjs/common';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

type ListMediaAssetsInput = Record<string, never>;

interface MediaAssetSummary {
  url: string;
  mimeType: string;
}

interface ListMediaAssetsOutput {
  assets: MediaAssetSummary[];
}

/**
 * Read-only инструмент (AI_PLATFORM_ROADMAP.md §9.6/§16 — расширение
 * `add_block`/`update_block_props` на `image`) — AI сам ничего не грузит
 * (загрузка бинарных данных через chat tool-calling не предусмотрена),
 * только читает уже загруженные владельцем через дашборд файлы
 * (`MediaAssetsService.list`, та же библиотека, что видит владелец), чтобы
 * знать, какой URL можно поставить в `image.src`. `low` risk — чтение через
 * существующий сервис, ничего не мутирует, тот же принцип, что у
 * `get_project_tree`.
 */
@Injectable()
export class ListMediaAssetsTool implements OnModuleInit {
  constructor(
    private readonly mediaAssetsService: MediaAssetsService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<ListMediaAssetsInput, ListMediaAssetsOutput> = {
      name: 'list_media_assets',
      description:
        'Возвращает список уже загруженных владельцем файлов (URL + тип), которые можно использовать в качестве src изображения через add_block/update_block_props. Не принимает аргументов.',
      riskLevel: 'low',
      parameters: { type: 'object', properties: {}, required: [] },
      parseInput: (): ListMediaAssetsInput => ({}),
      handler: async (_input, ctx: ToolContext): Promise<ListMediaAssetsOutput> => {
        const assets = await this.mediaAssetsService.list(ctx.businessId, ctx.actorId);
        return { assets: assets.map((asset) => ({ url: asset.url, mimeType: asset.mimeType })) };
      },
    };

    this.toolRegistry.register(definition);
  }
}
