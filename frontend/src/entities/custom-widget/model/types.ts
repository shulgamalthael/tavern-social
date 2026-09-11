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

/** Узкое подмножество backend's `WidgetFieldKind` (`custom-widgets/widget-
 * fields.ts`) — зеркало для UI (тот же принцип "две независимые копии
 * одного контракта", что и у `WIDGET_BLOCK_SCHEMAS` выше). Параметр виджета
 * (§62.1) — типизированное значение, подставляемое вместо `{{key}}`-
 * плейсхолдера в `schema` при вставке (см. `resolveWidgetFieldValues`,
 * `entities/custom-widget/lib`). */
export type WidgetFieldKind =
  'string' | 'number' | 'boolean' | 'enum' | 'mediaAsset' | 'linkTarget';

export interface WidgetFieldSchema {
  key: string;
  label: string;
  kind: WidgetFieldKind;
  maxLength?: number;
  values?: string[];
  min?: number;
  max?: number;
}

export interface CustomWidget {
  id: string;
  businessId: string;
  name: string;
  schema: WidgetBlock[];
  /** Параметры виджета (§62.1/§76) — пусто у виджетов без плейсхолдеров,
   * ведёт себя идентично версии до параметризации (см. `ComponentLibrary
   * Panel.tsx`'s `onAddWidget`/`onAddCatalogWidget` — вставка напрямую,
   * без модалки, когда пусто). */
  fields: WidgetFieldSchema[];
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

/** Один блок каталожного виджета (`GET /widget-catalog`) — НЕ то же самое,
 * что `WidgetBlock` выше: тот намеренно узкий (только 4 типа, которые умеет
 * собрать ручная форма создания виджета), а виджет из общего каталога может
 * содержать ЛЮБОЙ из ~130 типов блоков билдера — AI создаёт его через
 * `create_custom_widget` без ограничения этим узким списком (см. backend
 * `CatalogWidgetDto`). `type: string`, не union — тот же уровень типизации,
 * что и у `WebsiteBlock` (`entities/website/model/types.ts`), которого этот
 * тип по форме зеркалит, не импортируя (см. `insertWidgetBlocks`'s сигнатуру
 * — принимает именно эту форму, `{id, type, props}[]`, откуда бы она ни
 * пришла). */
export interface CatalogWidgetBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export interface CatalogWidget {
  id: string;
  name: string;
  schema: CatalogWidgetBlock[];
  /** См. `CustomWidget.fields` — тот же смысл, просто для каталожного
   * виджета (§74/§76): после §76 практически любой каталожный виджет несёт
   * хотя бы один параметр (текст/ссылка становятся плейсхолдерами при
   * приёмке в каталог), но поле остаётся опционально пустым для полноты
   * типа — на случай виджета совсем без параметризуемого контента. */
  fields: WidgetFieldSchema[];
}
