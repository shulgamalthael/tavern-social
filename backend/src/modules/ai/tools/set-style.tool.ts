import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { buildValidatedStyle, STYLE_FIELD_KEYS } from './lib/block-style-schema';
import { findBlockInPages, replaceBlockInPages } from './lib/block-tree';
import { ToolRegistryService } from './tool-registry.service';

/**
 * Третий записывающий AI-инструмент (AI_PLATFORM_ROADMAP.md, фаза AI-2).
 * В отличие от `add_block`/`update_block_props`, работает на блоке ЛЮБОГО
 * типа — `style` структурно одинаков у каждого блока (`BlockStyle`, см.
 * `lib/block-style-schema.ts`), поэтому не нужен per-type allowlist. Ищет
 * блок рекурсивно по всему дереву документа (см. `lib/block-tree.ts`) — не
 * только среди блоков верхнего уровня страницы.
 */

interface SetStyleInput {
  blockId: string;
  style: Record<string, unknown>;
}

interface SetStyleOutput {
  pageId: string;
  blockId: string;
  style: Record<string, unknown>;
}

@Injectable()
export class SetStyleTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<SetStyleInput, SetStyleOutput> = {
      name: 'set_style',
      description:
        'Меняет оформление (отступы, фон, выравнивание, ширину) УЖЕ СУЩЕСТВУЮЩЕГО блока по его id — ' +
        'работает на любом типе блока. Передавай только те поля style, которые нужно изменить: остальные ' +
        'не тронутся. Значение null у поля убирает его (возврат к оформлению по умолчанию).',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          blockId: { type: 'string', description: 'id блока, который нужно оформить' },
          style: {
            type: 'object',
            description:
              `Поля: background(none|surface|muted|primary|dark|custom|gradient), customBackgroundColor(hex вида ` +
              `#rrggbb — только когда background="custom"), gradientFrom/gradientTo(hex вида #rrggbb — только когда ` +
              `background="gradient"), gradientType(linear|radial, по умолчанию linear — только когда ` +
              `background="gradient"), gradientAngle(число 0-360, градус линейного градиента, по умолчанию 135 — ` +
              `только когда background="gradient" и gradientType="linear", игнорируется для radial), ` +
              `paddingY/paddingX/marginTop/marginBottom` +
              `(none|sm|md|lg|xl, либо число — свой отступ в px от 0 до 400), ` +
              `textAlign(left|center|right), textColor(hex вида #rrggbb — свой цвет текста блока, ` +
              `по умолчанию берётся из темы сайта), maxWidth(narrow|default|wide|full), ` +
              `borderWidth(none|thin|medium|thick — рамка вокруг всего блока), borderColor(hex вида #rrggbb — ` +
              `только когда borderWidth не "none", по умолчанию берётся из темы), ` +
              `shadow(none|soft|medium|strong|floating — тень всего блока). ` +
              `Раскладка — ТОЛЬКО у section/container/columns/column, задаёт, как блок располагает СВОИХ детей: ` +
              `display(block|flex|grid, по умолчанию block — обычная вертикальная стопка, "flex"/"grid" включают поля ниже), ` +
              `direction(row|column — только при display="flex", по умолчанию row), ` +
              `wrap(true|false — только при display="flex", перенос на новую строку), ` +
              `gap(none|sm|md|lg|xl, либо число — свой px, промежуток между детьми, для flex и grid), ` +
              `gridColumns(число 1-6 — только при display="grid", равные колонки), ` +
              `justify/align(start|center|end|space-between|space-around для justify, start|center|end|stretch для align — только при display≠"block"). ` +
              `Позиция В РЯДУ — у ЛЮБОГО блока, но действует только если его РОДИТЕЛЬ сам display:flex/grid: ` +
              `grow(grow|fixed, по умолчанию grow — растягивается; "fixed" требует fixedWidth), ` +
              `fixedWidth(число 20-800 — px, только при grow="fixed"), ` +
              `sticky(true|false — прилипает при прокрутке), stickyOffset(число 0-400 — px отступ от верха, только при sticky=true). ` +
              `Появление ПРИ ПРОКРУТКЕ — у ЛЮБОГО блока, срабатывает один раз, когда блок впервые попадает в зону видимости (не повторяется при скролле туда-обратно): ` +
              `entranceAnimation(none|fade|slide-up|slide-down|slide-left|slide-right|zoom-in, по умолчанию none — "none" явно выключает, остальные — направление появления), ` +
              `entranceDelay(число 0-800 — мс задержки перед стартом после появления в зоне видимости, только когда entranceAnimation≠"none"). ` +
              `Используй умеренно — анимация на каждом блоке страницы подряд утомляет, не усиливает: обычно достаточно героя и 2-3 акцентных секций, не всех. ` +
              `Эффект виден в Предпросмотре/на опубликованном сайте, не в самом холсте редактора — это осознанно (холст перерисовывается на каждое действие редактирования). ` +
              `Пример сайдбара: на columns — display:"flex"; на первой колонке — grow:"fixed", fixedWidth:280, sticky:true; на второй — ничего не менять (grow:"grow" по умолчанию). ` +
              `Допустимые ключи: ${STYLE_FIELD_KEYS.join(', ')}.`,
          },
        },
        required: ['blockId', 'style'],
      },
      parseInput: (raw): SetStyleInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { blockId, style } = raw as Record<string, unknown>;

        if (typeof blockId !== 'string' || blockId.trim().length === 0) {
          throw new Error('blockId обязателен и должен быть непустой строкой');
        }
        if (typeof style !== 'object' || style === null) {
          throw new Error('style обязателен и должен быть объектом');
        }
        if (Object.keys(style).length === 0) {
          throw new Error('style должен содержать хотя бы одно поле для изменения');
        }

        return { blockId, style: style as Record<string, unknown> };
      },
      handler: async (input, ctx: ToolContext): Promise<SetStyleOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const found = findBlockInPages(draft.document.pages, input.blockId);
        if (!found) {
          throw new Error(`Блок с id "${input.blockId}" не найден на этом сайте`);
        }

        const newStyle = buildValidatedStyle(found.block.style, input.style);

        const updatedPages = replaceBlockInPages(draft.document.pages, input.blockId, (block) => ({
          ...block,
          style: newStyle,
        }));

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: updatedPages,
          theme: draft.document.theme as unknown as Record<string, unknown>,
          settings: draft.document.settings,
        });

        return { pageId: found.page.id, blockId: input.blockId, style: newStyle };
      },
    };

    this.toolRegistry.register(definition);
  }
}
