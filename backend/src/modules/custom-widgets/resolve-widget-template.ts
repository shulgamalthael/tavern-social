import type { WebsiteBlock } from '@/modules/websites/websites.types';
import type { CuratedField } from '@/modules/ai/tools/lib/add-block-schemas';
import type { WidgetFieldSchema } from './widget-fields';

/** `{{key}}` — тот же алфавит, что у `WIDGET_FIELD_KEY_RE` (`widget-
 * fields.ts`): ключ параметра ОДНОВременно единственная форма плейсхолдера,
 * так что совпадение регулярки однозначно указывает на реальный параметр
 * виджета, а не на случайную строку пользователя, похожую на плейсхолдер
 * (`{{` — не встречающийся в обычном тексте паттерн). */
const PLACEHOLDER_RE = /\{\{([a-zA-Z][a-zA-Z0-9_]{0,39})\}\}/g;
/** Экспортируется отдельно для `widget-quality.lib.ts`'s приёмочной проверки
 * (AI_PLATFORM_ROADMAP.md §76) — та же самая проверка "это ЦЕЛИКОМ один
 * плейсхолдер объявленного параметра", не копия регулярки. */
export const EXACT_PLACEHOLDER_RE = /^\{\{([a-zA-Z][a-zA-Z0-9_]{0,39})\}\}$/;

/** Безопасное "заглушка вместо плейсхолдера" значение для проверки СТАТИЧЕСКОЙ
 * части шаблона на этапе `create_custom_widget`/`update_custom_widget`
 * (см. `detemplateProps` ниже) — реальное значение параметра подставляется
 * только один раз, по-настоящему, при вставке экземпляра
 * (`resolveWidgetTemplate`), и там же заново проверяется полной схемой
 * блока-владельца. Заглушка нужна ТОЛЬКО чтобы `buildValidatedProps` не
 * упал на явно неполном пропе (например, число, замененное строкой-
 * плейсхолдером) при сохранении шаблона — она никогда не сохраняется и не
 * показывается пользователю. */
function placeholderStandIn(field: CuratedField): unknown {
  switch (field.kind) {
    case 'number':
      return field.min ?? 0;
    case 'boolean':
      return false;
    case 'mediaAsset':
      return null;
    case 'linkTarget':
      return { type: 'external', url: '' };
    case 'enum':
      return field.values?.[0] ?? '';
    default:
      return '';
  }
}

/** Строковые значения плейсхолдеров (`{{key}}`), заменённые на безопасную
 * заглушку своего типа — параллельная карта `blockIndex.propKey ->
 * originalPlaceholderString`, чтобы вернуть их на место в уже
 * провалидированном+смёрженном с дефолтами результате (см.
 * `detemplateProps`/`reinsertPlaceholders`, обе вызываются из
 * `custom-widgets.types.ts`'s `parseWidgetSchema`). */
export interface DetemplateResult {
  detemplated: Record<string, unknown>;
  placeholders: Map<string, string>;
}

/** Готовит `props` одного блока шаблона к обычной валидации `buildValidated
 * Props` — целиком-плейсхолдерное (`props.someKey === "{{fieldKey}}"`)
 * значение НЕ-строкового поля временно заменяется заглушкой своего типа
 * (см. `placeholderStandIn`), чтобы не упасть на типовой проверке; для
 * `kind: 'string'` полей заглушка не нужна вообще — плейсхолдер и так уже
 * валидная строка (частичная подстановка внутри большего текста, например
 * `"Цена: {{price}} грн"`, тоже просто валидная строка). Рекурсия внутрь
 * `list`-пропсов НЕ производится — параметризация элементов списка не
 * поддерживается в этой версии (см. `WidgetFieldKind`'s форвард-комментарий):
 * если такое значение всё же передано, оно провалится на этапе type-check
 * `buildValidatedProps` как обычный некорректный проп ("должно быть
 * массивом"), с честной ошибкой, а не молча. */
export function detemplateProps(
  props: Record<string, unknown>,
  schemaFields: Record<string, CuratedField>,
  declaredFieldKeys: ReadonlySet<string>,
): DetemplateResult {
  const detemplated: Record<string, unknown> = {};
  const placeholders = new Map<string, string>();

  for (const [key, value] of Object.entries(props)) {
    const field = schemaFields[key];
    const match = typeof value === 'string' ? EXACT_PLACEHOLDER_RE.exec(value) : null;
    if (field && match && field.kind !== 'string' && declaredFieldKeys.has(match[1])) {
      placeholders.set(key, value as string);
      detemplated[key] = placeholderStandIn(field);
    } else {
      detemplated[key] = value;
    }
  }

  return { detemplated, placeholders };
}

/** Возвращает `validated` (результат `buildValidatedProps` на de-templated
 * пропсах) с исходными плейсхолдерами, восстановленными поверх — см.
 * `detemplateProps`'s комментарий про то, зачем они вообще временно
 * убирались. */
export function reinsertPlaceholders(
  validated: Record<string, unknown>,
  placeholders: Map<string, string>,
): Record<string, unknown> {
  if (placeholders.size === 0) return validated;
  const result = { ...validated };
  for (const [key, token] of placeholders) {
    result[key] = token;
  }
  return result;
}

/** Подставляет одно значение рекурсивно — строки с полным или частичным
 * совпадением `{{key}}` заменяются реальным (уже провалидированным,
 * `buildValidatedWidgetValues`) значением параметра; массивы/объекты
 * обходятся рекурсивно (нужно для `linkTarget`-подобных вложенных объектов
 * в самих пропсах блока — не для элементов `list`, см. модуль-комментарий
 * выше), примитивы возвращаются как есть. */
function substituteValue(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const exact = EXACT_PLACEHOLDER_RE.exec(value);
    if (exact && exact[1] in values) {
      return values[exact[1]];
    }
    if (!value.includes('{{')) return value;
    return value.replace(PLACEHOLDER_RE, (full, key: string) => {
      if (!(key in values)) return full;
      const v = values[key];
      // Частичная (не целиком-значение) подстановка имеет смысл только для
      // примитивов (string/number/boolean) — `mediaAsset`/`linkTarget`-поля
      // всегда объекты/URL-строки, встраивать их ВНУТРЬ большего текста
      // бессмысленно (дало бы "[object Object]"); в этом редком случае
      // неправильного использования шаблона оставляем плейсхолдер как есть —
      // видимый `{{key}}` в тексте честно сигнализирует о проблеме, вместо
      // молчаливой порчи текста.
      if (v === null || v === undefined) return '';
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        return String(v);
      }
      return full;
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteValue(item, values));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      result[key] = substituteValue(nested, values);
    }
    return result;
  }
  return value;
}

/**
 * Разворачивает сохранённый шаблон виджета (`CustomWidget.schema`, каждый
 * элемент — `{ id, type, props }`) в конкретные блоки, подставляя реальные
 * значения параметров (уже провалидированные `buildValidatedWidgetValues`)
 * вместо плейсхолдеров `{{key}}`. `id` каждого блока отбрасывается —
 * вызывающий код (`insert-custom-widget.tool.ts`) всё равно прогоняет
 * результат через `remapBlockIds`, тот же принцип "id виджета никогда не
 * доверяем напрямую", что и у `parseWidgetSchema`.
 *
 * НЕ является последним рубежом валидации: вызывающий код обязан прогнать
 * КАЖДЫЙ полученный блок ещё раз через `buildValidatedProps` полной схемы
 * блока-владельца (с реальными `refs` — media/страницы/товары/услуги этого
 * бизнеса) ПЕРЕД вставкой — подставленное значение параметра могло
 * технически нарушить ограничение самого пропса (например, `maxLength`
 * блока строже, чем у параметра виджета), и такая вторая проверка гарантирует
 * инвариант: виджет с параметрами не может произвести на странице проп,
 * который не мог бы произвести обычный `add_block`/ручное редактирование.
 */
export function resolveWidgetTemplate(
  template: WebsiteBlock[],
  values: Record<string, unknown>,
): Array<{ type: string; props: Record<string, unknown>; style?: Record<string, unknown> }> {
  return template.map((block) => ({
    type: block.type,
    props: substituteValue(block.props, values) as Record<string, unknown>,
    // Оформление блока (AI_PLATFORM_ROADMAP.md §78) НИКОГДА не шаблонизируется
    // — в отличие от `props`, `style` не несёт бизнес-специфичного контента
    // (текст/ссылки), которое имело бы смысл подставлять по `{{key}}` —
    // копируется как есть, уже провалидированное на этапе `parseWidgetSchema`.
    ...(block.style ? { style: block.style } : {}),
  }));
}

/** Есть ли в описании виджета хоть один параметр `kind: 'mediaAsset'`/
 * `'linkTarget'` — те же самые причины, что у `needsBlockRefs`
 * (`build-block-refs.ts`): большинство виджетов (текст/числа/переключатели)
 * не нуждаются в дорогом запросе за реальными media/страницами/товарами. */
export function widgetFieldsNeedRefs(fields: WidgetFieldSchema[]): boolean {
  return fields.some((field) => field.kind === 'mediaAsset' || field.kind === 'linkTarget');
}
