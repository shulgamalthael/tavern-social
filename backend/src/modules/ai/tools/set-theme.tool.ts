import { Injectable, type OnModuleInit } from '@nestjs/common';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import {
  buildValidatedTheme,
  THEME_BUTTON_STYLE_VALUES,
  THEME_CARD_BORDER_VALUES,
  THEME_CARD_SHADOW_VALUES,
  THEME_COLOR_KEYS,
  THEME_CONTAINER_WIDTH_VALUES,
  THEME_FONT_CHOICE_VALUES,
  THEME_GOOGLE_FONT_ID_VALUES,
  THEME_RADIUS_ALLOWED_VALUES,
  THEME_SECTION_SPACING_VALUES,
} from './lib/theme-schema';
import { ToolRegistryService } from './tool-registry.service';

/**
 * AI_PLATFORM_ROADMAP.md §78 — четвёртый записывающий AI-инструмент,
 * структурное зеркало `set-style.tool.ts`, но меняет ОБЩЕСАЙТОВУЮ тему
 * (`WebsiteTheme` — палитра/шрифты/радиус/стиль кнопок/ширина контейнера/
 * межсекционные отступы/оформление карточек), а не оформление одного блока.
 * До этого тула у AI не было способа подогнать сайт целиком под референсный
 * дизайн — только точечно стилизовать отдельные блоки через `set_style`.
 *
 * Человеческий путь (`ThemePanel.tsx` → `WebsitesService.saveDraft`) валидирует
 * `theme` только как "объект" (см. `UpdateWebsiteDocumentDto`'s комментарий) —
 * осознанно для доверенного браузера владельца, но небезопасно для AI-ввода
 * напрямую. `buildValidatedTheme` (`lib/theme-schema.ts`) — реальная валидация
 * ПЕРЕД тем, как патч вообще попадёт в `saveDraft`, тот же untrusted-input
 * принцип, что и у `buildValidatedProps`/`buildValidatedStyle`.
 */

interface SetThemeInput {
  theme: Record<string, unknown>;
}

interface SetThemeOutput {
  theme: Record<string, unknown>;
}

@Injectable()
export class SetThemeTool implements OnModuleInit {
  constructor(
    private readonly websitesService: WebsitesService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<SetThemeInput, SetThemeOutput> = {
      name: 'set_theme',
      description:
        'Меняет ОБЩЕСАЙТОВУЮ тему (палитру, шрифты, радиус скруглений, стиль кнопок, ширину контейнера, межсекционные отступы, оформление карточек) — в отличие от set_style, который оформляет ОДИН блок. ' +
        'Передавай только те поля, которые нужно изменить: остальные не тронутся. Полезно, когда владелец просит "подгони сайт под наш фирменный цвет/шрифт" или "сделай сайт по образцу вот этого дизайна" — с этого обычно и стоит начинать (тема), прежде чем точечно донастраивать отдельные блоки через set_style.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          theme: {
            type: 'object',
            description:
              `colors(объект, любые из ключей: ${THEME_COLOR_KEYS.join(', ')} — каждый hex вида #rrggbb), ` +
              `fonts(объект: heading/body — один из ${THEME_FONT_CHOICE_VALUES.join(', ')}; googleFontHeading/googleFontBody — один из ${THEME_GOOGLE_FONT_ID_VALUES.join(', ')}, учитывается только когда соответствующий heading/body="google", null убирает), ` +
              `radius(${THEME_RADIUS_ALLOWED_VALUES.join('|')}), ` +
              `buttonStyle(${THEME_BUTTON_STYLE_VALUES.join('|')}), ` +
              `containerWidth(${THEME_CONTAINER_WIDTH_VALUES.join('|')}), ` +
              `sectionSpacing(${THEME_SECTION_SPACING_VALUES.join('|')}), ` +
              `cardBorder(${THEME_CARD_BORDER_VALUES.join('|')}, null убирает), ` +
              `cardShadow(${THEME_CARD_SHADOW_VALUES.join('|')}, null убирает).`,
          },
        },
        required: ['theme'],
      },
      parseInput: (raw): SetThemeInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { theme } = raw as Record<string, unknown>;

        if (typeof theme !== 'object' || theme === null) {
          throw new Error('theme обязателен и должен быть объектом');
        }
        if (Object.keys(theme).length === 0) {
          throw new Error('theme должен содержать хотя бы одно поле для изменения');
        }

        return { theme: theme as Record<string, unknown> };
      },
      handler: async (input, ctx: ToolContext): Promise<SetThemeOutput> => {
        const draft = await this.websitesService.getDraft(ctx.businessId, ctx.actorId);
        const newTheme = buildValidatedTheme(
          draft.document.theme as unknown as Record<string, unknown>,
          input.theme,
        );

        await this.websitesService.saveDraft(ctx.businessId, ctx.actorId, {
          pages: draft.document.pages,
          theme: newTheme,
          settings: draft.document.settings,
        });

        return { theme: newTheme };
      },
    };

    this.toolRegistry.register(definition);
  }
}
