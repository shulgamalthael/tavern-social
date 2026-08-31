export type WidgetBlockType = 'heading' | 'text' | 'quote' | 'spacer';

export type CustomWidgetStatus = 'draft' | 'published';

/** Уже сохранённый блок виджета — форма один в один с backend's `WebsiteBlock`
 * (`entities/website/model/types.ts`), но здесь достаточно только `id`/
 * `type`/`props`: виджет в этой версии — плоский список без `children`
 * (см. `CustomWidget.schema`'s комментарий в backend schema.prisma). */
export interface WidgetBlock {
  id: string;
  type: WidgetBlockType;
  props: Record<string, string>;
}

export interface CustomWidget {
  id: string;
  businessId: string;
  name: string;
  schema: WidgetBlock[];
  status: CustomWidgetStatus;
  createdAt: string;
  updatedAt: string;
}

/** Что отправляется на запись — `{ blockType, props }`, БЕЗ `id` (backend
 * всегда генерирует свежий, см. `parseWidgetSchema`'s комментарий — клиентский
 * id, если прислать, просто игнорируется). */
export interface WidgetBlockInput {
  blockType: WidgetBlockType;
  props: Record<string, string>;
}

interface WidgetBlockFieldSchema {
  kind: 'string' | 'enum';
  maxLength?: number;
  values?: readonly string[];
}

interface WidgetBlockSchema {
  label: string;
  fields: Record<string, WidgetBlockFieldSchema>;
  defaultProps: Record<string, string>;
}

/** Зеркало backend's `BLOCK_SCHEMAS` (`ai/tools/lib/add-block-schemas.ts`) —
 * та же curated allowlist, что и AI-2's `add_block`/AI-6's `CustomWidget.
 * schema`-валидация переиспользует НАПРЯМУЮ (см. `custom-widgets.types.ts`).
 * Это ЗЕРКАЛО для UI (поля формы/лейблы/дефолты), не источник валидации —
 * backend по-прежнему единственный источник истины на запись, та же "две
 * независимые копии одного контракта" схема, что у `entities/rule`'s
 * `RULE_TRIGGER_FIELDS`. Значения СВЕРЕНЫ 1:1 с backend на момент написания —
 * если backend's allowlist когда-нибудь расширится, эта копия тоже потребует
 * обновления, тем же способом, что и любая другая из подобных копий в проекте. */
export const WIDGET_BLOCK_SCHEMAS: Record<WidgetBlockType, WidgetBlockSchema> = {
  heading: {
    label: 'Заголовок',
    fields: {
      text: { kind: 'string', maxLength: 300 },
      level: { kind: 'enum', values: ['h1', 'h2', 'h3'] },
      size: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] },
      color: { kind: 'enum', values: ['default', 'primary', 'muted'] },
    },
    defaultProps: { text: 'Заголовок раздела', level: 'h2', size: 'md', color: 'default' },
  },
  text: {
    label: 'Текст',
    fields: {
      text: { kind: 'string', maxLength: 2000 },
      color: { kind: 'enum', values: ['default', 'primary', 'muted'] },
    },
    defaultProps: { text: 'Расскажите о своём деле в паре предложений.', color: 'default' },
  },
  quote: {
    label: 'Цитата',
    fields: {
      text: { kind: 'string', maxLength: 1000 },
      author: { kind: 'string', maxLength: 200 },
    },
    defaultProps: { text: 'Отличный сервис и внимание к деталям.', author: 'Имя, компания' },
  },
  spacer: {
    label: 'Отступ',
    fields: {
      height: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] },
    },
    defaultProps: { height: 'md' },
  },
};

export const WIDGET_BLOCK_TYPES = Object.keys(WIDGET_BLOCK_SCHEMAS) as WidgetBlockType[];

export const WIDGET_BLOCK_FIELD_LABELS: Record<string, string> = {
  text: 'Текст',
  level: 'Уровень заголовка',
  size: 'Размер',
  color: 'Цвет',
  author: 'Автор',
  height: 'Высота',
};
