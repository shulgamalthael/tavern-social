/**
 * Подстановка значений параметров виджета (§62.1/§76) для РУЧНОЙ вставки —
 * зеркало backend's `substituteValue`/`resolveWidgetTemplate` (`backend/src/
 * modules/custom-widgets/resolve-widget-template.ts`), но не переиспользует
 * его напрямую: frontend и backend — разные рантаймы, тот же принцип "две
 * независимые копии одного контракта", что и у `WIDGET_BLOCK_SCHEMAS`
 * (`model/types.ts`).
 *
 * Намеренно БЕЗ обращения к backend — `ComponentLibraryPanel.tsx`'s ручная
 * вставка виджета (в отличие от AI-путя, `InsertCustomWidgetTool`) никогда не
 * прогоняла блоки через `buildValidatedProps`/реальные `refs` бизнеса: сама
 * вставка виджета в билдере — такое же клиентское редактирование документа,
 * как и любое другое действие в `website-store.ts` (`addBlock`, `insertBlock`
 * и т. п.), а `WebsitesService.saveDraft` на backend не валидирует пропсы
 * блоков курированной схемой вообще (только структуру страниц/санитайзинг
 * rich-текста) — курированная валидация есть только у AI-путей, где источник
 * данных untrusted. Подставлять значения здесь же, без круговой поездки на
 * backend, — тот же уровень доверия, что и у владельца, редактирующего проп
 * блока вручную через инспектор.
 */
const PLACEHOLDER_RE = /\{\{([a-zA-Z][a-zA-Z0-9_]{0,39})\}\}/g;
const EXACT_PLACEHOLDER_RE = /^\{\{([a-zA-Z][a-zA-Z0-9_]{0,39})\}\}$/;

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

interface WidgetTemplateBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

/**
 * Разворачивает сохранённый шаблон виджета в конкретные блоки — подставляет
 * реальные значения параметров вместо `{{key}}`. `id` каждого блока не важен
 * на входе (`insertWidgetBlocks`, `entities/website/model/website-store.ts`,
 * всё равно заново генерирует свежие id через `remapBlockIds` на вставке),
 * поэтому просто копируется как есть.
 */
export function resolveWidgetFieldValues<T extends WidgetTemplateBlock>(
  schema: T[],
  values: Record<string, unknown>,
): T[] {
  return schema.map((block) => ({
    ...block,
    props: substituteValue(block.props, values) as Record<string, unknown>,
  }));
}
