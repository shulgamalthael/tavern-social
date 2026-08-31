/**
 * AI-8 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.2, §4) — Custom
 * Database Builder v1. Тот же анти-риск приём, что уже применён к Custom
 * Widget Engine (§2.4/§14): §2.2 прямо предупреждает, что произвольная
 * пользовательская схема + миграции — "the highest-complexity, highest-risk
 * item in the whole mission". Вместо реальных Postgres DDL-миграций на
 * бизнес — декларативная EAV-модель поверх ДВУХ фиксированных таблиц
 * (`CustomEntity.fields`/`CustomEntityRecord.data`, оба `Json`), которые уже
 * существуют раз и навсегда: "создать сущность" — это записать строку JSON
 * с описанием формы, не выполнить DDL. Поля можно только ДОБАВЛЯТЬ
 * (`appendField`), никогда не удалять/переименовывать — та же "additive,
 * не migration" дисциплина, что уже применена к `Rule.actions`/
 * `CustomWidget.schema` (см. их комментарии): старые записи не могут
 * "сломаться", потому что форма только растёт.
 *
 * Все функции здесь чистые (без Prisma/DI/сети) — ручной парсер вместо
 * class-validator, потому что вход по природе вложенный JSON-blob
 * произвольной (но curated) формы, тот же принцип, что `rule-condition.lib.
 * ts`/`add-block-schemas.ts` (`AGENTS.md` backend §6). Используются
 * ОДИНАКОВО из owner-CRUD (`CustomEntitiesService`) и из AI-инструментов
 * (`create_entity`/`add_field`) — один источник правды на оба вызывающих,
 * не дублируется.
 */

export const CUSTOM_ENTITY_FIELD_TYPES = ['string', 'number', 'boolean', 'date'] as const;
export type CustomEntityFieldType = (typeof CUSTOM_ENTITY_FIELD_TYPES)[number];

/** `key` — латиница/цифры/`_`, начинается с буквы: используется и как JSON-
 * ключ в `CustomEntityRecord.data`, и (потенциально) как псевдоним поля в
 * будущих запросах — тот же формат, что и у идентификаторов большинства
 * языков программирования, безопасно предсказуемый. */
const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;
const MAX_FIELDS_PER_ENTITY = 40;

export interface CustomEntityField {
  key: string;
  label: string;
  type: CustomEntityFieldType;
  required: boolean;
}

export type CustomEntityRecordValue = string | number | boolean;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCustomEntityFieldType(value: unknown): value is CustomEntityFieldType {
  return (
    typeof value === 'string' && (CUSTOM_ENTITY_FIELD_TYPES as readonly string[]).includes(value)
  );
}

/** Разбирает и валидирует ОДНО поле — общий шаг для `parseEntityFields`
 * (несколько сразу, при создании сущности) и `add_field`/`addField`
 * (ровно одно, при расширении уже существующей). `existingKeys` — уже
 * занятые ключи (в этой же партии + уже сохранённые на сущности), чтобы
 * не допустить дубликат/тихую перезапись поля новым определением. */
export function parseSingleField(raw: unknown, existingKeys: string[]): CustomEntityField {
  if (!isPlainObject(raw)) {
    throw new Error('Поле должно быть объектом { key, label, type, required? }');
  }

  const { key, label, type, required } = raw;

  if (typeof key !== 'string' || !FIELD_KEY_PATTERN.test(key)) {
    throw new Error(
      'key обязателен: латиница/цифры/подчёркивание, должен начинаться с буквы (например customerName)',
    );
  }
  if (existingKeys.includes(key)) {
    throw new Error(`Поле с key "${key}" уже существует`);
  }
  if (typeof label !== 'string' || label.trim().length === 0 || label.length > 80) {
    throw new Error('label обязателен и должен быть строкой от 1 до 80 символов');
  }
  if (!isCustomEntityFieldType(type)) {
    throw new Error(`type должен быть одним из: ${CUSTOM_ENTITY_FIELD_TYPES.join(', ')}`);
  }
  if (required !== undefined && typeof required !== 'boolean') {
    throw new Error('required, если передан, должен быть boolean');
  }

  return { key, label: label.trim(), type, required: required ?? false };
}

/** Начальный набор полей при создании сущности — непустой массив, ключи
 * уникальны внутри самого массива (используется `parseSingleField` с
 * накапливаемым списком занятых ключей). */
export function parseEntityFields(raw: unknown): CustomEntityField[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('fields обязателен и должен быть непустым массивом полей');
  }
  if (raw.length > MAX_FIELDS_PER_ENTITY) {
    throw new Error(`Не более ${MAX_FIELDS_PER_ENTITY} полей на сущность`);
  }

  const fields: CustomEntityField[] = [];
  for (const item of raw) {
    const field = parseSingleField(
      item,
      fields.map((f) => f.key),
    );
    fields.push(field);
  }
  return fields;
}

/** Дополняет уже сохранённые поля сущности ровно одним новым — используется
 * и `add_field`, и owner-only REST-эндпоинтом добавления поля. Бросает,
 * если лимит полей уже исчерпан или ключ уже занят (см. `parseSingleField`). */
export function appendField(existing: CustomEntityField[], raw: unknown): CustomEntityField[] {
  if (existing.length >= MAX_FIELDS_PER_ENTITY) {
    throw new Error(`Не более ${MAX_FIELDS_PER_ENTITY} полей на сущность`);
  }
  const field = parseSingleField(
    raw,
    existing.map((f) => f.key),
  );
  return [...existing, field];
}

function isValidDateValue(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** Проверяет значение конкретного поля против его декларированного типа —
 * тот же "нет implicit coercion" принцип, что `rule-condition.lib.ts`
 * (число, пришедшее строкой, не тихо приводится к number). `date` хранится
 * строкой (ISO), не отдельным SQL-типом — `CustomEntityRecord.data` целиком
 * `Json`, единообразие проще, чем частичная типизация одного поля. */
function assertValueMatchesType(field: CustomEntityField, value: unknown): void {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`Поле "${field.key}" должно быть строкой`);
      }
      return;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Поле "${field.key}" должно быть числом`);
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`Поле "${field.key}" должно быть true/false`);
      }
      return;
    case 'date':
      if (!isValidDateValue(value)) {
        throw new Error(`Поле "${field.key}" должно быть датой в формате ISO-строки`);
      }
      return;
  }
}

/** Валидирует `CustomEntityRecord.data` против формы, объявленной на
 * `CustomEntity.fields` — "нет поля вне curated allowlist" (тот же принцип,
 * что `buildValidatedProps` для block props), не просто type-check каждого
 * значения по отдельности. Возвращает НОВЫЙ объект только с известными
 * полями (лишние ключи отбрасываются с ошибкой, не молча игнорируются). */
export function validateRecordData(
  fields: CustomEntityField[],
  raw: unknown,
): Record<string, CustomEntityRecordValue> {
  if (!isPlainObject(raw)) {
    throw new Error('data должен быть объектом');
  }

  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const unknownKeys = Object.keys(raw).filter((key) => !fieldsByKey.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`Неизвестные поля: ${unknownKeys.join(', ')}`);
  }

  const result: Record<string, CustomEntityRecordValue> = {};
  for (const field of fields) {
    const value = raw[field.key];
    if (value === undefined || value === null) {
      if (field.required) {
        throw new Error(`Поле "${field.key}" обязательно`);
      }
      continue;
    }
    assertValueMatchesType(field, value);
    result[field.key] = value as CustomEntityRecordValue;
  }
  return result;
}
