import { BadRequestException } from '@nestjs/common';
import {
  validateOneField,
  type BuildValidatedPropsRefs,
} from '@/modules/ai/tools/lib/add-block-schemas';

/** Узкое подмножество `CuratedField.kind` (`add-block-schemas.ts`) —
 * намеренно БЕЗ `list`/`dataSource`: параметр виджета — это ОДНО значение,
 * подставляемое в один или несколько пропсов шаблона (`resolve-widget-
 * template.ts`), не вложенная структура. Виджет с "повторяющимся списком"
 * — не сценарий этой версии (см. форвард-комментарий у `resolveWidgetTemplate`
 * про то, почему подстановка не рекурсирует в элементы `list`-пропсов) —
 * это ограничение, а не пробел: закрытый список kind здесь и есть граница
 * того, что вообще может прийти от AI/владельца в это поле. */
export type WidgetFieldKind =
  'string' | 'number' | 'boolean' | 'enum' | 'mediaAsset' | 'linkTarget';

const WIDGET_FIELD_KINDS: readonly WidgetFieldKind[] = [
  'string',
  'number',
  'boolean',
  'enum',
  'mediaAsset',
  'linkTarget',
];

export interface WidgetFieldSchema {
  key: string;
  label: string;
  kind: WidgetFieldKind;
  maxLength?: number;
  values?: string[];
  min?: number;
  max?: number;
}

/** Максимум параметров одного виджета — тот же принцип, что `DEFAULT_LIST_
 * MAX_ITEMS` в `add-block-schemas.ts`: AI-вход untrusted (`AGENTS.md` §3),
 * без верхней границы массив мог бы расти неограниченно. 20 с большим
 * запасом покрывает любой реалистичный "промо-блок"/"карточку с полями". */
const MAX_WIDGET_FIELDS = 20;

/** `^[a-zA-Z][a-zA-Z0-9_]{0,39}$` — ключ параметра одновременно служит
 * именем плейсхолдера `{{key}}` внутри шаблона (`resolve-widget-template.ts`,
 * та же регулярка `PLACEHOLDER_RE`) — ограничение до безопасного идентификатора
 * гарантирует, что плейсхолдер никогда не может случайно склеиться с
 * окружающим текстом шаблона неоднозначным образом. */
const WIDGET_FIELD_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

/** Дефолт для виджетов без `mediaAsset`/`linkTarget`-параметров — см.
 * `widgetFieldsNeedRefs` (`resolve-widget-template.ts`), не тратим запрос
 * за реальными media/страницами, если ни один параметр в них не нуждается. */
const EMPTY_WIDGET_REFS: BuildValidatedPropsRefs = {
  pageIds: new Set(),
  productIds: new Set(),
  serviceIds: new Set(),
  mediaAssetUrls: new Set(),
};

function isWidgetFieldKind(value: unknown): value is WidgetFieldKind {
  return typeof value === 'string' && (WIDGET_FIELD_KINDS as string[]).includes(value);
}

/**
 * Валидирует ОПИСАНИЕ параметров виджета (не значения — см.
 * `buildValidatedWidgetValues` ниже), как их прислал AI/владелец бизнеса
 * через `create_custom_widget`/`update_custom_widget` — тот же принцип "не
 * доверяем форме JSON-поля", что и у `parseWidgetSchema`
 * (`custom-widgets.types.ts`). Пустой/отсутствующий `fields` — валидный,
 * полностью обратно совместимый случай (существующие виджеты без
 * параметров, статичные снимки, как раньше).
 */
export function parseWidgetFields(raw: unknown): WidgetFieldSchema[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException('fields, если передан, должен быть массивом');
  }
  if (raw.length > MAX_WIDGET_FIELDS) {
    throw new BadRequestException(`fields не может содержать больше ${MAX_WIDGET_FIELDS} полей`);
  }

  const seenKeys = new Set<string>();

  return raw.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new BadRequestException(`fields[${index}] должен быть объектом`);
    }
    const { key, label, kind, maxLength, values, min, max } = item as Record<string, unknown>;

    if (typeof key !== 'string' || !WIDGET_FIELD_KEY_RE.test(key)) {
      throw new BadRequestException(
        `fields[${index}].key должен быть строкой из латинских букв/цифр/подчёркивания, начинающейся с буквы (до 40 символов)`,
      );
    }
    if (seenKeys.has(key)) {
      throw new BadRequestException(
        `fields[${index}].key "${key}" повторяется — ключи должны быть уникальны`,
      );
    }
    seenKeys.add(key);

    if (typeof label !== 'string' || label.trim().length === 0 || label.length > 100) {
      throw new BadRequestException(
        `fields[${index}].label должен быть непустой строкой до 100 символов`,
      );
    }

    if (!isWidgetFieldKind(kind)) {
      throw new BadRequestException(
        `fields[${index}].kind должен быть одним из: ${WIDGET_FIELD_KINDS.join(', ')}`,
      );
    }

    const field: WidgetFieldSchema = { key, label: label.trim(), kind };

    if (kind === 'enum') {
      if (
        !Array.isArray(values) ||
        values.length === 0 ||
        !values.every((v) => typeof v === 'string')
      ) {
        throw new BadRequestException(
          `fields[${index}].values обязателен и должен быть непустым массивом строк для kind "enum"`,
        );
      }
      field.values = values;
    }

    if (kind === 'number') {
      if (min !== undefined && typeof min !== 'number') {
        throw new BadRequestException(`fields[${index}].min, если передан, должен быть числом`);
      }
      if (max !== undefined && typeof max !== 'number') {
        throw new BadRequestException(`fields[${index}].max, если передан, должен быть числом`);
      }
      if (typeof min === 'number') field.min = min;
      if (typeof max === 'number') field.max = max;
    }

    if (kind === 'string' && maxLength !== undefined) {
      if (typeof maxLength !== 'number' || maxLength <= 0) {
        throw new BadRequestException(
          `fields[${index}].maxLength должен быть положительным числом`,
        );
      }
      field.maxLength = maxLength;
    }

    return field;
  });
}

/**
 * Валидирует РЕАЛЬНЫЕ значения параметров при вставке экземпляра виджета
 * (`insert_custom_widget`) — каждое поле обязано присутствовать (без
 * дефолтов в этой версии: явное "не хватает значения" безопаснее тихой
 * подстановки пустого дефолта, тот же принцип, что и у `buildValidatedProps`'s
 * "неизвестные поля отклоняются, а не отбрасываются"). Переиспользует
 * `validateOneField` — ТУ ЖЕ функцию, которой `add_block`/`update_block_
 * props` валидируют обычные пропсы блока, а не копию её логики: значение
 * параметра виджета не может пройти проверку, которую не прошло бы точно
 * такое же значение обычного пропса блока того же `kind`.
 */
export function buildValidatedWidgetValues(
  fields: WidgetFieldSchema[],
  rawValues: unknown,
  refs: BuildValidatedPropsRefs = EMPTY_WIDGET_REFS,
): Record<string, unknown> {
  const input =
    typeof rawValues === 'object' && rawValues !== null && !Array.isArray(rawValues)
      ? (rawValues as Record<string, unknown>)
      : {};

  const allowedKeys = new Set(fields.map((field) => field.key));
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new BadRequestException(`Неизвестные параметры виджета: ${unknownKeys.join(', ')}`);
  }

  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.key in input)) {
      throw new BadRequestException(
        `Не хватает значения параметра "${field.label}" (${field.key})`,
      );
    }
    // `WidgetFieldSchema` — совместимое подмножество `CuratedField` (тот же
    // набор ключей `kind`/`maxLength`/`values`/`min`/`max`, минус `itemFields`/
    // `maxItems`, которые `validateOneField` читает только для `kind: 'list'` —
    // сюда никогда не попадающего, см. `WidgetFieldKind`).
    result[field.key] = validateOneField(field.key, field, input[field.key], refs);
  }
  return result;
}
