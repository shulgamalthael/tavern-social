import { Injectable, type OnModuleInit } from '@nestjs/common';
import { CustomWidgetsService } from '@/modules/custom-widgets/custom-widgets.service';
import { ALLOWED_BLOCK_TYPES } from './lib/add-block-schemas';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { STYLE_FIELD_KEYS } from './lib/block-style-schema';
import { ToolRegistryService } from './tool-registry.service';

/**
 * AI-6's first AI-authoring entry point (AI_PLATFORM_ROADMAP.md §14/§16.1)
 * — the Custom Widget Engine (§14) shipped API-only (owner CRUD, no AI tool),
 * same "prove storage/validation first" precedent as AI-5's `Rule` engine.
 * This tool is a thin wrapper around the *existing* `CustomWidgetsService.
 * create`, not a new write path: `parseInput` here only checks the outer
 * shape (name is a string, schema is a non-empty array of plain objects) —
 * the real per-block validation (allowed `blockType`, `props` shape) is the
 * SAME `parseWidgetSchema`/`add-block-schemas.ts` allowlist `add_block`
 * already uses, enforced inside `CustomWidgetsService.create` itself, not
 * duplicated here (same "tool layer is a new caller of old code" principle,
 * §1). A widget created this way is a `draft`-status `CustomWidget` row,
 * indistinguishable from one created through the owner-only REST API —
 * still not embeddable on any page yet (§14/§16.2's own scope boundary).
 *
 * `fields` (§62.1 — "widget kind" parametrization) lets the AI declare a
 * genuinely new, named, reusable, PARAMETRIZED widget "kind" — not just a
 * frozen paste-again snapshot: `schema`'s string props may contain
 * `{{fieldKey}}` placeholders for any key declared here, resolved with
 * real, freshly-validated values on every `insert_custom_widget` call (see
 * that tool's own comment). This is deliberately NOT "AI writes code" —
 * `fields` is a closed, typed enum (`string`/`number`/`boolean`/`enum`/
 * `mediaAsset`/`linkTarget`, see `WidgetFieldKind`) validated by the exact
 * same `validateOneField` that already guards every ordinary block prop,
 * and the resolved template is re-validated against the owning block's own
 * curated schema before insertion (`InsertCustomWidgetTool`) — a widget kind
 * can never produce a prop value that a hand-placed block of the same type
 * couldn't already produce. No new code-execution surface, no new trust
 * boundary: this stays firmly inside mission §2.4's "declarative
 * composition, not AI-authored arbitrary code" stance.
 *
 * Общий каталог виджетов (AI_PLATFORM_ROADMAP.md §74) — этот тул, и только
 * он, передаёт `autoShare: true` в `CustomWidgetsService.create` (owner-only
 * REST этого поля не знает вообще — виджет, созданный вручную через
 * дашборд, никогда не попадает в общий каталог сам по себе). Виджет,
 * прошедший приёмочную проверку (`assessWidgetQuality`) и не дублирующий
 * уже расшаренный, становится виден в "Каталоге виджетов" ВСЕМ бизнесам, не
 * только этому — `sharedToLibrary`/`shareRejectionReason` в выводе тула дают
 * модели честно объяснить владельцу исход, не молчать о нём.
 */

interface CreateCustomWidgetInput {
  name: string;
  schema: Array<{
    blockType: string;
    props?: Record<string, unknown>;
    style?: Record<string, unknown>;
  }>;
  fields?: Array<Record<string, unknown>>;
}

interface CreateCustomWidgetOutput {
  widgetId: string;
  name: string;
  blockCount: number;
  /** `true` — виджет добавлен в общий каталог виджетов, виден другим
   * бизнесам. `false` — сохранён только для этого бизнеса, см. `reason`. */
  sharedToLibrary: boolean;
  /** Заполнено только при `sharedToLibrary: false` — человекочитаемая
   * причина (см. `assessWidgetQuality`/`CustomWidgetsService.create`). */
  reason?: string;
}

@Injectable()
export class CreateCustomWidgetTool implements OnModuleInit {
  constructor(
    private readonly customWidgetsService: CustomWidgetsService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<CreateCustomWidgetInput, CreateCustomWidgetOutput> = {
      name: 'create_custom_widget',
      description:
        'Сохраняет именованную, переиспользуемую композицию блоков как виджет (разместить на странице — отдельным вызовом insert_custom_widget). ' +
        `Каждый элемент schema — это { blockType, props? }, где blockType — один из: ${ALLOWED_BLOCK_TYPES.join(', ')} (те же типы, что у add_block). ` +
        'Необязательный fields объявляет ТИПИЗИРОВАННЫЕ параметры виджета (kind: string/number/boolean/enum/mediaAsset/linkTarget) — ' +
        'строковые значения props в schema тогда могут содержать плейсхолдеры {{fieldKey}} (например, props.text = "{{headline}}"), ' +
        'подставляемые РЕАЛЬНЫМИ значениями при каждой вставке через insert_custom_widget (values). ' +
        'Без fields виджет ведёт себя как раньше — статичная композиция без параметров. ' +
        'Полезно, когда владелец просит подготовить один и тот же набор блоков заранее для повторного использования, особенно если разные вставки должны отличаться текстом/картинкой/ссылкой. ' +
        'Если виджет содержит реальный, непустой контент (не только отступы/разделители, не только значения по умолчанию) и такого ещё нет в общем каталоге — он автоматически становится виден ВСЕМ бизнесам платформы, не только этому (см. sharedToLibrary/reason в ответе). ' +
        'ВАЖНО для попадания в общий каталог: любой ТЕКСТ (text/heading/description/label и т. п.) и любая ССЫЛКА (url/link) с настоящим, конкретным содержимым ДОЛЖНЫ быть объявлены как параметр в fields и подставлены в schema как {{fieldKey}} — не пишите реальный текст/ссылку прямо в props. Проп можно оставить БЕЗ параметра, только если он остаётся ровно тем значением по умолчанию, что и так стоит у этого блока (например, не трогать text у heading вообще). Виджет с забитым текстом/ссылкой без параметра всё равно сохранится для этого бизнеса, но НЕ попадёт в общий каталог (см. reason в ответе) — цель каталога в том, чтобы виджет был переиспользуемой болванкой, а не готовым контентом одного бизнеса. ' +
        'Каждый элемент schema может нести необязательный style — ТОЧНО ТА ЖЕ форма, что принимает set_style (фон/градиент, отступы, рамка/тень, выравнивание, flex/grid-раскладка детей, появление при прокрутке) — используй его, чтобы виджет выглядел готовым, а не голым: оформление, в отличие от текста/ссылок, НЕ нужно объявлять параметром — оно не блокирует попадание в общий каталог, наоборот, красиво оформленный виджет даже с пустыми/дефолтными props полезен другим бизнесам как визуальный шаблон.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Название виджета, например "Блок с адресом"' },
          schema: {
            type: 'array',
            description: 'Непустой список блоков виджета: [{ blockType, props? }, ...]',
            // Gemini function calling требует `items` на КАЖДОМ параметре
            // `type: 'array'` (проверено живым вызовом — без него весь
            // запрос падает 400 INVALID_ARGUMENT ещё до того, как модель
            // успевает выбрать инструмент, что ломает business_chat
            // целиком, не только этот tool: все function declarations
            // отправляются одним списком). `props` внутри намеренно не
            // детализирован глубже `object` — реальная форма зависит от
            // `blockType` (см. `ALLOWED_BLOCK_TYPES`/`add-block-schemas.ts`),
            // её проверяет `parseInput` ниже, не эта JSON Schema.
            items: {
              type: 'object',
              properties: {
                blockType: { type: 'string', enum: [...ALLOWED_BLOCK_TYPES] },
                props: { type: 'object', description: 'См. props в add_block для blockType.' },
                style: {
                  type: 'object',
                  description: `Необязательно — оформление блока, та же форма, что у style в set_style. Допустимые ключи: ${STYLE_FIELD_KEYS.join(', ')}.`,
                },
              },
              required: ['blockType'],
            },
          },
          fields: {
            type: 'array',
            description:
              'Необязательно — параметры виджета: [{ key, label, kind, values?, min?, max?, maxLength? }, ...]. ' +
              'key — латиница/цифры/подчёркивание, начинается с буквы (это же имя плейсхолдера {{key}}). ' +
              'kind — один из: string, number, boolean, enum, mediaAsset, linkTarget. values обязателен для enum. min/max — для number.',
            items: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  description: 'Латиница/цифры/_, начинается с буквы, до 40 символов',
                },
                label: { type: 'string', description: 'Человекочитаемое название параметра' },
                kind: {
                  type: 'string',
                  enum: ['string', 'number', 'boolean', 'enum', 'mediaAsset', 'linkTarget'],
                },
                values: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Только для kind: enum',
                },
                min: { type: 'number', description: 'Только для kind: number' },
                max: { type: 'number', description: 'Только для kind: number' },
                maxLength: { type: 'number', description: 'Только для kind: string' },
              },
              required: ['key', 'label', 'kind'],
            },
          },
        },
        required: ['name', 'schema'],
      },
      parseInput: (raw): CreateCustomWidgetInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const { name, schema, fields } = raw as Record<string, unknown>;

        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('name обязателен и должен быть непустой строкой');
        }
        if (!Array.isArray(schema) || schema.length === 0) {
          throw new Error('schema обязателен и должен быть непустым массивом блоков');
        }
        for (const [index, item] of schema.entries()) {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            throw new Error(`schema[${index}] должен быть объектом`);
          }
        }
        if (fields !== undefined && !Array.isArray(fields)) {
          throw new Error('fields, если передан, должен быть массивом');
        }

        return {
          name: name.trim(),
          schema: schema as CreateCustomWidgetInput['schema'],
          fields: fields as CreateCustomWidgetInput['fields'],
        };
      },
      handler: async (input, ctx: ToolContext): Promise<CreateCustomWidgetOutput> => {
        const widget = await this.customWidgetsService.create(
          ctx.businessId,
          ctx.actorId,
          { name: input.name, schema: input.schema, fields: input.fields },
          { autoShare: true },
        );
        return {
          widgetId: widget.id,
          name: widget.name,
          blockCount: widget.schema.length,
          sharedToLibrary: widget.isShared,
          ...(widget.shareRejectionReason ? { reason: widget.shareRejectionReason } : {}),
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}
