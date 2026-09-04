import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { countDescendants, findBlockInPages, removeBlockFromPages } from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Первый удаляющий AI-инструмент (AI_PLATFORM_ROADMAP.md §41.2 — до этой
 * итерации у модели не было способа исправить СТРУКТУРНУЮ ошибку: неверную
 * вложенность/лишний блок можно было только оставить как есть или
 * перезаписать `props`/`style` того, что уже создано). Работает на блоке
 * любого типа, где бы он ни лежал в дереве документа (см. `lib/block-tree.
 * ts`) — как и `set_style`, не привязан к per-type allowlist'у `add_block`.
 *
 * `high`, не `medium`: в отличие от `add_block`/`set_style`/`update_block_
 * props`, здесь нет истории версий/undo (см. форвард-комментарий `Websites
 * Service.publish` про то, что версии/откат в этом проекте вообще не
 * заведены) — удаление блока-контейнера безвозвратно уносит с собой ВСЕ его
 * `children`. Это тот же класс необратимости, что и у `publish_website`
 * (единственного другого `high`-инструмента в проекте), только без даже той
 * смягчающей оговорки, что есть у публикации («драфт остаётся драфтом») —
 * здесь теряются реальные данные.
 *
 * Карточка подтверждения (`AiChatPanel.tsx`, AI-9) сегодня показывает только
 * имя инструмента и уровень риска — НЕ содержимое `args` (тот же
 * `publish_website` этим не страдал, у него `args` пустой). Раз владелец
 * не увидит из самой карточки, что именно удалится, инструкция инструмента
 * явно просит модель называть это словами в своём сообщении ПЕРЕД вызовом —
 * то же, что уже принято для `publish_website` ("владелец сам увидит
 * подтверждение, спрашивать текстом не нужно"), но с обратным смыслом: тут
 * спросить/предупредить текстом — единственный способ владельцу вообще
 * узнать объём удаления до нажатия «Подтвердить».
 */

interface DeleteBlockInput {
  blockId: string;
}

interface DeleteBlockOutput {
  pageId: string;
  blockId: string;
  blockType: string;
  /** Число дочерних блоков (рекурсивно, сам блок не считая), удалённых
   * вместе с ним — 0, если блок был листовым. */
  descendantsDeleted: number;
}

@Injectable()
export class DeleteBlockTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<DeleteBlockInput, DeleteBlockOutput> = {
      name: 'delete_block',
      description:
        'Безвозвратно удаляет блок с сайта по его id — вместе со всеми его дочерними блоками, если это контейнер (section/container/columns/column). ' +
        'Отмены/истории версий нет — прежде чем вызывать этот инструмент, проверь через get_block, есть ли у блока children, и если да — прямо в своём сообщении предупреди владельца, СКОЛЬКО блоков удалится вместе с ним (карточка подтверждения этого не показывает). ' +
        'Система сама покажет владельцу запрос на подтверждение перед выполнением — отдельно спрашивать разрешение текстом не нужно, только предупредить о последствиях.',
      riskLevel: 'high',
      parameters: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id блока, который нужно удалить' },
        },
        required: ['blockId'],
      },
      parseInput: (raw): DeleteBlockInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockId } = raw as Record<string, unknown>;
        if (typeof blockId !== 'string' || blockId.trim().length === 0) {
          throw new Error('blockId обязателен и должен быть непустой строкой');
        }
        return { blockId };
      },
      handler: async (input, ctx: ToolContext): Promise<DeleteBlockOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const found = findBlockInPages(draft.document.pages, input.blockId);
        if (!found) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }

        const descendantsDeleted = countDescendants(found.block);
        const { pages: updatedPages } = removeBlockFromPages(draft.document.pages, input.blockId);

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return {
          pageId: found.page.id,
          blockId: input.blockId,
          blockType: found.block.type,
          descendantsDeleted,
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
