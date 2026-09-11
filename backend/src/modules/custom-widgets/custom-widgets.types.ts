import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { CustomWidgetStatus } from '@prisma/client';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import {
  ALLOWED_BLOCK_TYPES,
  BLOCK_SCHEMAS,
  buildValidatedProps,
  isAllowedBlockType,
} from '@/modules/ai/tools/lib/add-block-schemas';
import { buildValidatedStyle } from '@/modules/ai/tools/lib/block-style-schema';
import { detemplateProps, reinsertPlaceholders } from './resolve-widget-template';
import type { WidgetFieldSchema } from './widget-fields';

/** Один элемент `CreateCustomWidgetDto.schema`/`UpdateCustomWidgetDto.schema`
 * КАК ЕГО ПРИСЛАЛ владелец бизнеса — форма один в один с тем, что AI-2's
 * `add_block` уже принимает от модели (`blockType`/`props`), не случайное
 * совпадение: виджет в этой версии — именно композиция из ТЕХ ЖЕ curated
 * блоков, никакой новой формы. */
interface RawWidgetBlockInput {
  blockType?: unknown;
  props?: unknown;
  /** Оформление блока (AI_PLATFORM_ROADMAP.md §78) — та же `BlockStyle`,
   * что и у обычного блока, вставленного вручную или через `add_block`/
   * `set_style`, валидируется той же `buildValidatedStyle` (переиспользуем,
   * не копия). Раньше это поле молча отбрасывалось — виджет мог быть
   * стилизован ИИ через `set_style` ПЕРЕД сохранением, но, попав в
   * `create_custom_widget`, терял всё оформление: каждый виджет был обречён
   * оставаться "голым" независимо от того, что задумал автор. */
  style?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Валидирует `CustomWidget.schema` КАК ЕГО ПРИСЛАЛ владелец бизнеса — тем же
 * принципом "не доверяем форме JSON-поля" (`AI_PLATFORM_ROADMAP.md §3`), что
 * `RulesService`'s `parseRuleCondition`/`parseRuleActions` (AI-5) и tool'ы
 * AI-2 сами. Переиспользует `BLOCK_SCHEMAS`/`buildValidatedProps` из
 * `add-block-schemas.ts` НАПРЯМУЮ, не копирует — один и тот же блок,
 * добавленный AI-инструментом `add_block` или сохранённый здесь как часть
 * виджета, проходит РОВНО одну и ту же проверку допустимых полей/типов
 * (см. `CustomWidget.schema`'s комментарий в схеме).
 *
 * Каждому блоку присваивается свежий `id` (`randomUUID()`), даже если
 * клиент прислал свой — сохранённый виджет ещё нигде не встроен в реальную
 * страницу в этой версии (см. `CustomWidgetsService`'s комментарий про то,
 * почему рендеринг/встраивание отложены), но id всё равно не должен
 * приходить от клиента: то же untrusted-input рассуждение, что и у `add_
 * block` (`AddBlockTool` тоже сам генерирует `id`, не берёт от модели).
 *
 * `image`/`button` (AI_PLATFORM_ROADMAP.md §9.6/§16 — расширение allowlist)
 * технически уже входят в `ALLOWED_BLOCK_TYPES`, но эта функция вызывает
 * `buildValidatedProps` БЕЗ `refs` (пустые множества по умолчанию) —
 * намеренно, не пробел: `parseWidgetSchema` вызывается на уровне DTO, без
 * `businessId` в сигнатуре (виджет ещё не привязан к бизнесу на этом шаге
 * валидации), поэтому `image.src` здесь всегда должен быть `null`, а
 * `button.url` — только `external`/`anchor`/`phone`/`email` (варианты, не
 * требующие проверки существования). Виджет с `page`/`addToCart`/
 * `bookAppointment`-ссылкой или непустым `src` сегодня отклоняется тут же,
 * как "должен ссылаться на существующий..." — безопасный отказ, не
 * ложное принятие. Прокинуть `businessId`-scoped `refs` сюда — отдельное
 * расширение (`CustomWidgetsService.create/update` уже знают `businessId`,
 * этой функции просто нужно его передать), не сделано в этой итерации.
 *
 * `web3wallet` (AI_PLATFORM_ROADMAP.md §35, AI-20) не задевает это
 * ограничение вообще — у него нет `mediaAsset`/`linkTarget` полей, только
 * `string`/`number`, так что виджет с этим блоком проходит `EMPTY_REFS` без
 * особого случая. Единственная живая ссылка, которую он несёт, —
 * businessId самого виджета (уже есть в `CustomWidgetsService`), не что-то
 * внутри `props`: собранный виджет с `web3wallet`, встроенный на страницу,
 * покажет кошелёк ТОГО бизнеса, чья это страница — то же самое поведение,
 * что у блока, добавленного напрямую через `add_block`/вручную.
 */
/**
 * `declaredFieldKeys` — ключи `WidgetFieldSchema` этого же виджета (пусто —
 * поведение идентично исходной версии до параметризации): позволяет
 * ОДНОМУ значению НЕ-строкового пропса (`props.someKey === "{{fieldKey}}"`)
 * временно пройти как плейсхолдер, а не быть отклонённым проверкой типа —
 * см. `detemplateProps`/`reinsertPlaceholders` (`resolve-widget-
 * template.ts`) про то, как именно. Частичные плейсхолдеры внутри
 * `kind: 'string'` пропсов (например, `"Цена: {{price}} грн"`) вообще не
 * нуждаются в этом — они и так уже валидная строка.
 */
/** Найденная и закрытая уязвимость (AI_PLATFORM_ROADMAP.md §75) — раньше
 * `schema` проверялся только на "непустой", без верхней границы. Виджет с
 * тысячами блоков раньше раздувал только СОБСТВЕННЫЙ список бизнеса; после
 * появления общего каталога (§74) такой же виджет, единожды пройдя
 * `assessWidgetQuality` (та проверяет тривиальность содержимого, не
 * размер), возвращался бы в `GET /widget-catalog` КАЖДОМУ бизнесу
 * навсегда — реальный вектор раздувания ответа/хранилища для всех, не
 * только для автора. 30 — с большим запасом выше любого реалистичного
 * виджета (для сравнения, `MAX_POST_IMAGES = 10` в постах). */
const MAX_WIDGET_BLOCKS = 30;

export function parseWidgetSchema(
  raw: unknown,
  declaredFieldKeys: ReadonlySet<string> = new Set(),
): WebsiteBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException('schema должен быть непустым массивом блоков');
  }
  if (raw.length > MAX_WIDGET_BLOCKS) {
    throw new BadRequestException(`schema не может содержать больше ${MAX_WIDGET_BLOCKS} блоков`);
  }

  return raw.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new BadRequestException(`schema[${index}] должен быть объектом`);
    }

    const { blockType, props, style } = item as RawWidgetBlockInput;
    if (typeof blockType !== 'string' || !isAllowedBlockType(blockType)) {
      throw new BadRequestException(
        `schema[${index}].blockType должен быть одним из: ${ALLOWED_BLOCK_TYPES.join(', ')}`,
      );
    }
    if (props !== undefined && !isPlainObject(props)) {
      throw new BadRequestException(`schema[${index}].props, если передан, должен быть объектом`);
    }

    const schema = BLOCK_SCHEMAS[blockType];
    const { detemplated, placeholders } = detemplateProps(
      props ?? {},
      schema.fields,
      declaredFieldKeys,
    );

    let validatedProps: Record<string, unknown>;
    try {
      validatedProps = buildValidatedProps(schema, detemplated);
    } catch (error) {
      throw new BadRequestException(
        `schema[${index}]: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    validatedProps = reinsertPlaceholders(validatedProps, placeholders);

    let validatedStyle: Record<string, unknown> | undefined;
    if (style !== undefined) {
      try {
        // Виджет никогда не редактирует "существующий" style — каждый
        // сохраняемый блок собирается заново, поэтому первый аргумент
        // всегда `undefined` (та же семантика, что у `set_style` на
        // ЕЩЁ НЕ существующем блоке).
        validatedStyle = buildValidatedStyle(undefined, style);
      } catch (error) {
        throw new BadRequestException(
          `schema[${index}].style: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      id: randomUUID(),
      type: blockType,
      props: validatedProps,
      ...(validatedStyle ? { style: validatedStyle } : {}),
    };
  });
}

export interface CustomWidgetDto {
  id: string;
  businessId: string;
  name: string;
  schema: WebsiteBlock[];
  fields: WidgetFieldSchema[];
  status: CustomWidgetStatus;
  /** Общий каталог (AI_PLATFORM_ROADMAP.md §74) — `true`, только если этот
   * виджет создан через `create_custom_widget` (AI) и прошёл проверку
   * `assessWidgetQuality`. Владелец видит это поле на своих же виджетах в
   * "Мои виджеты" — просто информативно, само по себе ничего не открывает. */
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Запись общего каталога виджетов (`GET /widget-catalog`) — НАМЕРЕННО без
 * `businessId`/`status`/владельческих полей: каталог анонимен, чтобы не
 * раскрывать, какой бизнес что создал, другим (потенциально конкурирующим)
 * бизнесам. */
export interface CatalogWidgetDto {
  id: string;
  name: string;
  schema: WebsiteBlock[];
  fields: WidgetFieldSchema[];
}
