/**
 * Схемы curated allowlist блоков для `add_block` (см. комментарий на классе
 * `AddBlockTool`) — вынесены в чистую библиотечную функцию без NestJS-
 * зависимостей, тем же способом, что и `modules/appointments/lib/
 * availability.ts`, чтобы её можно было юнит-тестировать напрямую
 * (`add-block-schemas.test.ts`), а не только curl-верификацией через живой
 * чат (которая покрывает happy path, но не удобна для проверки каждого
 * отдельного отказа валидации).
 */

export type AllowedBlockType = 'heading' | 'text' | 'quote' | 'spacer';

interface CuratedField {
  kind: 'string' | 'enum';
  maxLength?: number;
  values?: readonly string[];
}

interface CuratedBlockSchema {
  label: string;
  fields: Record<string, CuratedField>;
  defaultProps: Record<string, unknown>;
}

/** Сверено 1:1 с `headingFields`/`defaultProps` в `blocks/typography/index.tsx`
 * — `size` здесь плоская строка, не `{ desktop: 'md' }`: `readResponsiveProp`
 * (`registry.ts`) сама трактует плоское значение как «на всех вьюпортах», это
 * штатный, не деградированный путь, просто без per-viewport override, который
 * AI сегодня не умеет выразить (нет инструмента для этого). */
const HEADING_SCHEMA: CuratedBlockSchema = {
  label: 'Заголовок',
  fields: {
    text: { kind: 'string', maxLength: 300 },
    level: { kind: 'enum', values: ['h1', 'h2', 'h3'] },
    size: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] },
    color: { kind: 'enum', values: ['default', 'primary', 'muted'] },
  },
  defaultProps: { text: 'Заголовок раздела', level: 'h2', size: 'md', color: 'default' },
};

const TEXT_SCHEMA: CuratedBlockSchema = {
  label: 'Текст',
  fields: {
    text: { kind: 'string', maxLength: 2000 },
    color: { kind: 'enum', values: ['default', 'primary', 'muted'] },
  },
  defaultProps: { text: 'Расскажите о своём деле в паре предложений.', color: 'default' },
};

const QUOTE_SCHEMA: CuratedBlockSchema = {
  label: 'Цитата',
  fields: {
    text: { kind: 'string', maxLength: 1000 },
    author: { kind: 'string', maxLength: 200 },
  },
  defaultProps: { text: 'Отличный сервис и внимание к деталям.', author: 'Имя, компания' },
};

const SPACER_SCHEMA: CuratedBlockSchema = {
  label: 'Отступ',
  fields: {
    height: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] },
  },
  defaultProps: { height: 'md' },
};

export const BLOCK_SCHEMAS: Record<AllowedBlockType, CuratedBlockSchema> = {
  heading: HEADING_SCHEMA,
  text: TEXT_SCHEMA,
  quote: QUOTE_SCHEMA,
  spacer: SPACER_SCHEMA,
};

export const ALLOWED_BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as AllowedBlockType[];

export function isAllowedBlockType(value: string): value is AllowedBlockType {
  return (ALLOWED_BLOCK_TYPES as string[]).includes(value);
}

/** Валидирует сырые `props` от модели против curated-схемы конкретного типа
 * блока и возвращает готовый `props`, слитый поверх `base` (по умолчанию —
 * `schema.defaultProps`, как для новосоздаваемого блока в `add_block`;
 * `update_block_props` передаёт сюда `props` УЖЕ СУЩЕСТВУЮЩЕГО блока, чтобы
 * частичное обновление меняло только присланные поля, не сбрасывая
 * остальные обратно к дефолтам) — незнакомый ключ или неверный тип/enum-
 * значение бросает (модель — untrusted input, см. `AI_PLATFORM_ROADMAP.md`
 * §3), а не молча отбрасывается или проходит как есть. */
export function buildValidatedProps(
  schema: (typeof BLOCK_SCHEMAS)[AllowedBlockType],
  rawProps: unknown,
  base: Record<string, unknown> = schema.defaultProps,
): Record<string, unknown> {
  const input =
    typeof rawProps === 'object' && rawProps !== null ? (rawProps as Record<string, unknown>) : {};

  const unknownKeys = Object.keys(input).filter((key) => !(key in schema.fields));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Неизвестные поля для блока "${schema.label}": ${unknownKeys.join(', ')}. Допустимые поля: ${Object.keys(schema.fields).join(', ')}`,
    );
  }

  const result: Record<string, unknown> = { ...base };
  for (const [key, field] of Object.entries(schema.fields)) {
    const value = input[key];
    if (value === undefined) continue;

    if (field.kind === 'enum') {
      if (typeof value !== 'string' || !field.values?.includes(value)) {
        throw new Error(`Поле "${key}" должно быть одним из: ${field.values?.join(', ')}`);
      }
    } else {
      if (typeof value !== 'string') {
        throw new Error(`Поле "${key}" должно быть строкой`);
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        throw new Error(`Поле "${key}" не может быть длиннее ${field.maxLength} символов`);
      }
    }
    result[key] = value;
  }

  return result;
}
