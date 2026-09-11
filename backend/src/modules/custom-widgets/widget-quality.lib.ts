import { createHash } from 'node:crypto';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import { BLOCK_SCHEMAS, type AllowedBlockType } from '@/modules/ai/tools/lib/add-block-schemas';
import { EXACT_PLACEHOLDER_RE } from './resolve-widget-template';

/**
 * Приёмочная проверка для общего каталога виджетов (AI_PLATFORM_ROADMAP.md
 * §74) — намеренно НЕ ещё один вызов Gemini ("судить качество" LLM'ом было
 * бы недетерминированным, дорогим и непрозрачным), а фиксированная,
 * объяснимая проверка на существующих данных схемы (`BLOCK_SCHEMAS`), тот
 * же уровень строгости, что и остальная валидация этого проекта.
 * `assessWidgetQuality` вызывается ТОЛЬКО из `CustomWidgetsService.create`,
 * когда вызывающий передал `autoShare: true` (только AI-путь,
 * `create_custom_widget`) — виджет, не прошедший её, всё равно СОЗДАЁТСЯ
 * для бизнеса как обычно, просто не входит в `isShared` каталог.
 */

/** Чисто структурные/декоративные типы — сам по себе набор из них не несёт
 * "нового функционала" (буквальная формулировка запроса владельца), это
 * пустая рамка. Список — те же типы, что уже выделены как "структурные" в
 * остальном коде (`layout/index.tsx`'s `EmptyProps`-блоки плюс разделители),
 * не новая классификация. */
const TRIVIAL_BLOCK_TYPES = new Set<AllowedBlockType>([
  'section',
  'container',
  'column',
  'spacer',
  'divider',
  'dividerlabel',
  'dividericon',
  'shapedivider',
]);

export interface WidgetQualityResult {
  passes: boolean;
  /** Заполнено только при `passes: false` — `create_custom_widget`'s тул
   * возвращает его AI как есть, чтобы модель могла честно объяснить
   * владельцу, почему виджет не попал в общий каталог. */
  reason?: string;
  /** Считается ВСЕГДА, независимо от `passes` — используется отдельно, для
   * поиска почти-дубликатов среди уже расшаренных виджетов (см.
   * `CustomWidgetsService.create`). */
  schemaHash: string;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Сортирует ключи объекта рекурсивно перед стрингификацией — тот же
 * `JSON.stringify` для двух объектов с одинаковыми парами ключ/значение, но
 * в разном порядке, иначе дал бы разные строки и, соответственно, разные
 * хэши для фактически идентичного виджета. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const entries = sortedKeys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Хэш игнорирует `id`/`children` блоков намеренно: два виджета с
 * одинаковыми типами/пропсами блоков верхнего уровня — по сути один и тот
 * же виджет, даже если случайные id отличаются (они и не могут совпасть —
 * `parseWidgetSchema` сам генерирует их через `randomUUID()`). Вложенные
 * `children` в виджетах v1 не встречаются (композиция — плоский список), но
 * поле на `WebsiteBlock` формально есть — явно отбрасываем, а не молча
 * получаем разные хэши для одинаковых виджетов при случайном заполнении. */
function computeSchemaHash(schema: WebsiteBlock[]): string {
  const canonical = schema.map((block) => ({ type: block.type, props: block.props }));
  return createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

/** `string`/`linkTarget` — те же два `CuratedField.kind`, для которых
 * владелец потребовал (AI_PLATFORM_ROADMAP.md §76): "Ссылки + текст —
 * виджеты становятся болванками". `number`/`boolean`/`enum` (цвет, размер,
 * уровень заголовка и т. п.) — не "контент", который раскрывает бизнес
 * конкретного автора, оставляем их как раньше, без ограничения.
 * `mediaAsset` уже принудительно пуст в этой версии на уровне `parseWidget
 * Schema` (см. её комментарий про `image.src` — всегда `null`, если не
 * плейсхолдер), отдельного правила здесь не нужно. */
const CONTENT_FIELD_KINDS = new Set(['string', 'linkTarget']);

/** Ищет первый проп блока, который несёт готовый ("забитый") текст/ссылку
 * вместо параметра — по одному на весь виджет достаточно, чтобы честно
 * объяснить причину отказа (`reason`), та же экономность, что и у двух
 * других проверок этой функции. Значение уже провалидировано и смёржено с
 * дефолтами (`parseWidgetSchema` вызывается ДО `assessWidgetQuality`, см.
 * `CustomWidgetsService.create`) — значит, единственный способ пропу
 * "остаться пустым" — буквально совпасть со своим дефолтом, а единственный
 * способ быть параметром — быть ЦЕЛИКОМ плейсхолдером объявленного `field`
 * (частичная подстановка вроде `"Цена: {{price}} грн"` для целей каталога
 * НЕ считается — виджет должен стать болванкой целиком, не наполовину). */
function findUnparametrizedContent(
  schema: WebsiteBlock[],
  declaredFieldKeys: ReadonlySet<string>,
): string | undefined {
  for (const block of schema) {
    const blockSchema = BLOCK_SCHEMAS[block.type as AllowedBlockType];
    if (!blockSchema) continue;

    for (const [key, field] of Object.entries(blockSchema.fields)) {
      if (!CONTENT_FIELD_KINDS.has(field.kind)) continue;

      const value = block.props[key];
      const defaultValue = blockSchema.defaultProps[key];
      if (isDeepEqual(value, defaultValue)) continue;

      const match = typeof value === 'string' ? EXACT_PLACEHOLDER_RE.exec(value) : null;
      if (match && declaredFieldKeys.has(match[1])) continue;

      return (
        `Блок "${block.type}": поле "${key}" содержит готовый текст/ссылку вместо параметра — ` +
        'для общего каталога замените его на {{имяПараметра}} (fields) или оставьте значение по умолчанию.'
      );
    }
  }
  return undefined;
}

export function assessWidgetQuality(
  schema: WebsiteBlock[],
  declaredFieldKeys: ReadonlySet<string> = new Set(),
): WidgetQualityResult {
  const schemaHash = computeSchemaHash(schema);

  const hasSubstantiveBlock = schema.some(
    (block) => !TRIVIAL_BLOCK_TYPES.has(block.type as AllowedBlockType),
  );
  if (!hasSubstantiveBlock) {
    return {
      passes: false,
      reason:
        'Виджет состоит только из структурных блоков (отступы/разделители/контейнеры) — нет содержательного блока с реальным функционалом.',
      schemaHash,
    };
  }

  // Оформление (AI_PLATFORM_ROADMAP.md §78) — реальная ценность для каталога
  // сама по себе, даже если props при этом остались дефолтными: красиво
  // стилизованная пустая карточка (градиент+тень+скругление) полезна другим
  // бизнесам как визуальный шаблон не меньше, чем содержательный текст.
  // Поэтому виджет проходит эту проверку, если ЛИБО хоть один блок отличается
  // пропами от дефолта, ЛИБО хоть один блок несёт непустой style.
  const allDefaultAndUnstyled = schema.every((block) => {
    const defaults = BLOCK_SCHEMAS[block.type as AllowedBlockType]?.defaultProps;
    const hasCustomProps = !isDeepEqual(block.props, defaults);
    const hasStyle = Boolean(block.style) && Object.keys(block.style as object).length > 0;
    return !hasCustomProps && !hasStyle;
  });
  if (allDefaultAndUnstyled) {
    return {
      passes: false,
      reason:
        'Все блоки виджета оставлены со значениями по умолчанию и без оформления — нечем поделиться с другими бизнесами.',
      schemaHash,
    };
  }

  const unparametrizedContentReason = findUnparametrizedContent(schema, declaredFieldKeys);
  if (unparametrizedContentReason) {
    return { passes: false, reason: unparametrizedContentReason, schemaHash };
  }

  return { passes: true, schemaHash };
}
