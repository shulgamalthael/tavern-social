/**
 * Схемы curated allowlist блоков для `add_block`/`update_block_props` (см.
 * комментарий на классе `AddBlockTool`) — вынесены в чистую библиотечную
 * функцию без NestJS-зависимостей, тем же способом, что и `modules/
 * appointments/lib/availability.ts`, чтобы её можно было юнит-тестировать
 * напрямую (`add-block-schemas.test.ts`), а не только curl-верификацией
 * через живой чат.
 *
 * Каждая схема здесь сверена 1:1 с полями/`defaultProps` РЕАЛЬНОГО блока во
 * frontend-реестре (`entities/website/blocks/<category>/index.tsx`) — это
 * НЕЗАВИСИМАЯ копия того же контракта (backend не импортирует frontend-код,
 * тот же приём, что у `currencies.ts`/AI chat model types), поэтому при
 * правке полей блока на frontend нужно вручную обновить и схему здесь.
 *
 * Виды полей (`CuratedField.kind`):
 * - `string`/`enum`/`number`/`boolean` — примитивы, как в обычном JSON.
 * - `linkTarget`/`mediaAsset` — требуют проверки существования (страница
 *   сайта/товар/услуга/уже загруженный файл), которую эта функция сама не
 *   делает (остаётся чистой, без Prisma) — вызывающий тул обязан собрать
 *   `BuildValidatedPropsRefs` через `buildBlockRefs` ДО вызова.
 * - `dataSource` — параметры запроса данных `{limit, sort}` (см.
 *   `DataSourceValue` в frontend `model/types.ts`) для data-driven блоков
 *   (`productgrid`/`servicegrid`/`bloggrid`) — сами товары/услуги/посты
 *   дозагружаются заново при каждом рендере, `props` хранит только ПАРАМЕТРЫ
 *   запроса, не сами данные.
 * - `list` — повторяемый массив однотипных элементов (карточки/пункты меню/
 *   вопросы FAQ и т.п.) — `itemFields` описывает форму ОДНОГО элемента
 *   (рекурсивно та же система полей), `maxItems` — верхняя граница длины
 *   (защита от неограниченного массива, AI-input untrusted).
 */

import { validateLinkTarget, type LinkTargetRefs } from './link-target-schema';

export type AllowedBlockType =
  // layout
  | 'section'
  | 'container'
  | 'columns'
  | 'column'
  | 'spacer'
  | 'divider'
  | 'dividerlabel'
  | 'dividericon'
  | 'shapedivider'
  // typography
  | 'heading'
  | 'text'
  | 'richtext'
  | 'quote'
  // media
  | 'image'
  | 'gallery'
  | 'video'
  | 'logo'
  | 'imagecarousel'
  | 'imagecarouselthumbs'
  | 'beforeafter'
  | 'beforeaftertabs'
  | 'gallerylightbox'
  | 'gallerylightboxmasonry'
  | 'imagehotspot'
  | 'videogallery'
  | 'audioembed'
  | 'imagecaption'
  // actions
  | 'button'
  | 'buttongroup'
  | 'link'
  | 'cta'
  // business
  | 'businessheader'
  | 'hero'
  | 'dualcta'
  | 'about'
  | 'services'
  | 'servicecard'
  | 'pricing'
  | 'team'
  | 'teammember'
  | 'teamsocial'
  | 'testimonials'
  | 'reviews'
  | 'faq'
  | 'accordionlist'
  | 'faqsearch'
  | 'contact'
  | 'openinghours'
  | 'businesshours'
  | 'location'
  | 'locationslist'
  | 'getdirections'
  | 'sociallinks'
  | 'nativesharebutton'
  | 'testimonialsslider'
  | 'teamslider'
  | 'videotestimonialslider'
  | 'quotespotlight'
  | 'herovideo'
  | 'herosplitform'
  | 'pricingtoggle'
  | 'pricingsingle'
  | 'pricingcalculator'
  | 'testimonialwall'
  | 'ratingsummary'
  | 'platformratings'
  | 'faqtabs'
  | 'socialshare'
  | 'videotestimonial'
  | 'socialproofbar'
  // content
  | 'featuregrid'
  | 'cards'
  | 'articles'
  | 'stats'
  | 'banner'
  | 'timeline'
  | 'timelinesimple'
  | 'timelinemedia'
  | 'tabs'
  | 'tabsvertical'
  | 'countdown'
  | 'countdownbar'
  | 'logocloud'
  | 'logocloudmarquee'
  | 'comparison'
  | 'comparisonsplit'
  | 'progressbars'
  | 'progresscircles'
  | 'stickybar'
  | 'stickycountdownbar'
  | 'popupoffer'
  | 'exitintentpopup'
  | 'contactbubble'
  | 'contactbubblemulti'
  | 'statscounter'
  | 'statscountericons'
  | 'portfoliogrid'
  | 'portfoliomasonry'
  | 'cookiebar'
  | 'cookiebarminimal'
  | 'steps'
  | 'stepsicons'
  | 'iconlist'
  | 'iconlistinline'
  | 'announcementbar'
  | 'announcementbarmarquee'
  | 'scarcitybar'
  | 'couponcode'
  | 'eventcountdown'
  | 'proscons'
  | 'calloutbox'
  | 'datatable'
  | 'quizsingle'
  | 'statshero'
  // commerce / booking / blog (data-driven, capability-gated)
  | 'productgrid'
  | 'servicegrid'
  | 'bloggrid'
  // forms
  | 'contactform'
  | 'newsletterform'
  | 'simpleform'
  | 'newsletterpopup'
  // navigation
  | 'footer'
  | 'breadcrumbs'
  | 'entitysearch'
  | 'anchornav'
  // utility
  | 'embed'
  | 'scrollprogress'
  | 'backtotop'
  | 'scrollcue'
  // web3
  | 'web3wallet'
  // advertising
  | 'adslot';

/** Контейнерные типы — сверено 1:1 с `isContainer: true` в
 * `entities/website/blocks/layout/index.tsx` (frontend-реестр). Единственная
 * причина, по которой backend вообще знает об этом (в остальном он curated-
 * блоки не различает контейнер/не-контейнер) — `add_block`'s `parentId`
 * (см. `add-block.tool.ts`): вложить блок можно только ВНУТРЬ контейнера, не
 * внутрь `heading`/`text`/т.п., у которых `children` в принципе не читается
 * ни одним рендерером. */
export const CONTAINER_BLOCK_TYPES: ReadonlySet<AllowedBlockType> = new Set([
  'section',
  'container',
  'columns',
  'column',
]);

/** Сверено 1:1 с `allowedChildren: ['column']` у `columns` в frontend-
 * реестре (`layout/index.tsx`) — число реальных колонок там определяется
 * количеством дочерних `column`-блоков, произвольный тип ребёнка сломал бы
 * это предположение (см. её комментарий). Родители, которых здесь нет
 * (`section`/`container`/`column`), принимают любой allowed-тип ребёнка. */
export const ALLOWED_CHILDREN: Partial<Record<AllowedBlockType, ReadonlySet<AllowedBlockType>>> = {
  columns: new Set(['column']),
};

/** Сверено 1:1 с `ICON_CHOICE_OPTIONS` (`entities/website/blocks/shared/
 * icon-choices.ts`) — курируемый набор иконок для полей вида «иконка
 * карточки» (`services`/`featuregrid`/`servicecard`'s `icon`). */
const ICON_CHOICE_VALUES = [
  'star',
  'heart',
  'check',
  'shield',
  'globe',
  'clock',
  'sparkle',
  'chart',
  'cpu',
  'mail',
  'briefcase',
  'building',
  'dumbbell',
  'graduation',
  'utensils',
  'bag',
] as const;

const DEFAULT_TEXT_COLOR_VALUES = ['default', 'primary', 'muted'] as const;

export interface CuratedField {
  kind:
    'string' | 'enum' | 'linkTarget' | 'mediaAsset' | 'number' | 'boolean' | 'dataSource' | 'list';
  maxLength?: number;
  values?: readonly string[];
  /** Только для `kind: 'number'`. */
  min?: number;
  max?: number;
  /** Только для `kind: 'list'` — схема ОДНОГО элемента массива (рекурсивно
   * та же форма `Record<string, CuratedField>`). */
  itemFields?: Record<string, CuratedField>;
  /** Только для `kind: 'list'` — верхняя граница числа элементов; без явного
   * значения — разумный дефолт (`DEFAULT_LIST_MAX_ITEMS` ниже), не
   * «безлимит» (AI-input untrusted, см. `AGENTS.md` §3). */
  maxItems?: number;
}

/** Дефолт для `list`-полей без явного `maxItems` в схеме конкретного блока
 * (большинство — короткие карточные сетки/меню, 20 элементов с большим
 * запасом покрывает любой реалистичный случай, не давая массиву расти
 * неограниченно). */
const DEFAULT_LIST_MAX_ITEMS = 20;

/** Множества id/URL, против которых проверяются `linkTarget`/`mediaAsset`
 * поля — см. `LinkTargetRefs`. Собираются `buildBlockRefs` ТОЛЬКО когда
 * `needsBlockRefs` (`build-block-refs.ts`) находит хотя бы одно такое поле
 * в схеме — большинство простых текстовых блоков не платят за это лишним
 * запросом к БД. */
export interface BuildValidatedPropsRefs extends LinkTargetRefs {
  mediaAssetUrls: ReadonlySet<string>;
}

const EMPTY_REFS: BuildValidatedPropsRefs = {
  pageIds: new Set(),
  productIds: new Set(),
  serviceIds: new Set(),
  mediaAssetUrls: new Set(),
};

/** Совпадает с frontend's `EMPTY_LINK_TARGET` (`entities/website/model/
 * resolve-link.ts`) — две независимые копии одного контракта. */
const EMPTY_LINK_TARGET = { type: 'external', url: '' };

interface CuratedBlockSchema {
  label: string;
  /** Сверено 1:1 с `BlockCategory`/`category` в frontend-реестре — только
   * для того, чтобы модель (через `get_block_schema`) могла сгруппировать
   * типы по смыслу, ни на что в валидации не влияет. */
  category: string;
  fields: Record<string, CuratedField>;
  defaultProps: Record<string, unknown>;
  /** Сверено 1:1 с `BlockDefinition.capability` во frontend-реестре — только
   * `productgrid`/`servicegrid`/`bloggrid` его используют сегодня. Блок,
   * УЖЕ размещённый на сайте, продолжает работать даже если капабилити потом
   * выключили (тот же принцип, что и у самого рендерера, см. `registry.ts`'s
   * комментарий про `BlockDefinition.capability`) — гейт применяется только
   * при СОЗДАНИИ через `add_block` (`AddBlockTool`'s handler), не здесь. */
  capability?: string;
}

// --- Layout ------------------------------------------------------------

/** Сверено 1:1 с `EmptyProps`/`defaultProps: {}` у `section`/`container`/
 * `columns`/`column` в `blocks/layout/index.tsx` — у всех четырёх нет
 * собственных `props` вообще (вся видимая настройка — общий `BlockStyle`
 * через `set_style`, включая поля «Раскладка»), поэтому `fields: {}` — не
 * заглушка, а точный контракт: любой ключ в `props` для этих типов — ошибка
 * валидации, как и должно быть. */
const EMPTY_BLOCK_SCHEMA = (label: string): CuratedBlockSchema => ({
  label,
  category: 'layout',
  fields: {},
  defaultProps: {},
});

const SECTION_SCHEMA = EMPTY_BLOCK_SCHEMA('Секция');
const CONTAINER_SCHEMA = EMPTY_BLOCK_SCHEMA('Контейнер');
const COLUMNS_SCHEMA = EMPTY_BLOCK_SCHEMA('Колонки');
const COLUMN_SCHEMA = EMPTY_BLOCK_SCHEMA('Колонка');

const SPACER_SCHEMA: CuratedBlockSchema = {
  label: 'Отступ',
  category: 'layout',
  fields: { height: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] } },
  defaultProps: { height: 'md' },
};

const DIVIDER_SCHEMA: CuratedBlockSchema = {
  label: 'Разделитель',
  category: 'layout',
  fields: { style: { kind: 'enum', values: ['solid', 'dashed'] } },
  defaultProps: { style: 'solid' },
};

const DIVIDERLABEL_SCHEMA: CuratedBlockSchema = {
  label: 'Разделитель с текстом',
  category: 'layout',
  fields: { text: { kind: 'string', maxLength: 60 } },
  defaultProps: { text: 'или' },
};

const DIVIDERICON_SCHEMA: CuratedBlockSchema = {
  label: 'Разделитель с иконкой',
  category: 'layout',
  fields: { icon: { kind: 'enum', values: ICON_CHOICE_VALUES } },
  defaultProps: { icon: 'star' },
};

/** `color` — обычная строка (hex/CSS-цвет), не отдельный `kind` — того же
 * приёма, что и везде на этом бэкенде: `kind` описывает тип ЗНАЧЕНИЯ для
 * валидации, а не то, каким контролом оно редактируется на frontend (там у
 * этого же поля `control: 'color'`, см. `entities/website/blocks/layout/
 * index.tsx`). */
const SHAPEDIVIDER_SCHEMA: CuratedBlockSchema = {
  label: 'Фигурный разделитель',
  category: 'layout',
  fields: {
    shape: { kind: 'enum', values: ['wave', 'blob', 'triangle'] },
    color: { kind: 'string', maxLength: 20 },
    height: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] },
    flip: { kind: 'boolean' },
    animated: { kind: 'boolean' },
  },
  defaultProps: { shape: 'wave', color: '#2563eb', height: 'md', flip: false, animated: true },
};

// --- Typography ----------------------------------------------------------

const HEADING_SCHEMA: CuratedBlockSchema = {
  label: 'Заголовок',
  category: 'typography',
  fields: {
    text: { kind: 'string', maxLength: 300 },
    level: { kind: 'enum', values: ['h1', 'h2', 'h3'] },
    // Плоская строка, не `{ desktop: 'md' }` — `readResponsiveProp`
    // (`registry.ts`) сама трактует плоское значение как «на всех
    // вьюпортах», штатный путь, просто без per-viewport override, который
    // AI сегодня не умеет выразить (нет инструмента для этого).
    size: { kind: 'enum', values: ['sm', 'md', 'lg', 'xl'] },
    color: { kind: 'enum', values: DEFAULT_TEXT_COLOR_VALUES },
  },
  defaultProps: { text: 'Заголовок раздела', level: 'h2', size: 'md', color: 'default' },
};

const TEXT_SCHEMA: CuratedBlockSchema = {
  label: 'Текст',
  category: 'typography',
  fields: {
    text: { kind: 'string', maxLength: 2000 },
    color: { kind: 'enum', values: DEFAULT_TEXT_COLOR_VALUES },
  },
  defaultProps: { text: 'Расскажите о своём деле в паре предложений.', color: 'default' },
};

const RICHTEXT_SCHEMA: CuratedBlockSchema = {
  label: 'Длинный текст',
  category: 'typography',
  fields: { text: { kind: 'string', maxLength: 6000 } },
  defaultProps: {
    text: 'Первый абзац рассказывает главное.\n\nВторой абзац добавляет подробности — историю, ценности или то, чем вы отличаетесь.',
  },
};

const QUOTE_SCHEMA: CuratedBlockSchema = {
  label: 'Цитата',
  category: 'typography',
  fields: {
    text: { kind: 'string', maxLength: 1000 },
    author: { kind: 'string', maxLength: 200 },
  },
  defaultProps: { text: 'Отличный сервис и внимание к деталям.', author: 'Имя, компания' },
};

// --- Media -----------------------------------------------------------------

/** `src` — `mediaAsset`: AI может указать только уже загруженный владельцем
 * через дашборд файл (см. `ListMediaAssetsTool`), сам ничего не грузит —
 * загрузка бинарных данных через chat tool-calling не предусмотрена ни
 * одним LLM API, которым пользуется этот проект. */
const IMAGE_SCHEMA: CuratedBlockSchema = {
  label: 'Изображение',
  category: 'media',
  fields: {
    src: { kind: 'mediaAsset' },
    alt: { kind: 'string', maxLength: 200 },
    objectFit: { kind: 'enum', values: ['cover', 'contain'] },
    radius: { kind: 'enum', values: ['none', 'sm', 'md', 'lg', 'full'] },
    link: { kind: 'linkTarget' },
    width: { kind: 'enum', values: ['auto', 'full'] },
  },
  defaultProps: {
    src: null,
    alt: '',
    objectFit: 'cover',
    radius: 'md',
    link: EMPTY_LINK_TARGET,
    width: 'full',
  },
};

const GALLERY_SCHEMA: CuratedBlockSchema = {
  label: 'Галерея',
  category: 'media',
  fields: {
    images: {
      kind: 'list',
      maxItems: 24,
      itemFields: { url: { kind: 'mediaAsset' } },
    },
    columns: { kind: 'number', min: 2, max: 5 },
  },
  defaultProps: { images: [{ url: null }, { url: null }, { url: null }], columns: 3 },
};

const VIDEO_SCHEMA: CuratedBlockSchema = {
  label: 'Видео',
  category: 'media',
  fields: {
    embedUrl: { kind: 'string', maxLength: 2000 },
    caption: { kind: 'string', maxLength: 200 },
  },
  defaultProps: { embedUrl: '', caption: '' },
};

const LOGO_SCHEMA: CuratedBlockSchema = {
  label: 'Логотип',
  category: 'media',
  fields: { height: { kind: 'number', min: 24, max: 160 } },
  defaultProps: { height: 40 },
};

// Competitor-widget-library batch 2 — media (imagecarousel/imagecarouselthumbs
// share one shape, beforeafter/beforeaftertabs share another) — тот же
// принцип 1:1 сверки с frontend, что и у batch 1 (§50).

const CAROUSEL_FIELDS: Record<string, CuratedField> = {
  items: {
    kind: 'list',
    maxItems: 12,
    itemFields: {
      image: { kind: 'mediaAsset' },
      caption: { kind: 'string', maxLength: 150 },
    },
  },
  autoPlay: { kind: 'boolean' },
  interval: { kind: 'number', min: 2, max: 15 },
};

const CAROUSEL_DEFAULT_PROPS: Record<string, unknown> = {
  items: [
    { image: null, caption: '' },
    { image: null, caption: '' },
    { image: null, caption: '' },
  ],
  autoPlay: false,
  interval: 5,
};

const IMAGECAROUSEL_SCHEMA: CuratedBlockSchema = {
  label: 'Слайдер изображений',
  category: 'media',
  fields: CAROUSEL_FIELDS,
  defaultProps: CAROUSEL_DEFAULT_PROPS,
};

const IMAGECAROUSELTHUMBS_SCHEMA: CuratedBlockSchema = {
  label: 'Слайдер с миниатюрами',
  category: 'media',
  fields: CAROUSEL_FIELDS,
  defaultProps: CAROUSEL_DEFAULT_PROPS,
};

const BEFOREAFTER_FIELDS: Record<string, CuratedField> = {
  beforeImage: { kind: 'mediaAsset' },
  afterImage: { kind: 'mediaAsset' },
  beforeLabel: { kind: 'string', maxLength: 40 },
  afterLabel: { kind: 'string', maxLength: 40 },
};

const BEFOREAFTER_DEFAULT_PROPS: Record<string, unknown> = {
  beforeImage: null,
  afterImage: null,
  beforeLabel: 'До',
  afterLabel: 'После',
};

const BEFOREAFTER_SCHEMA: CuratedBlockSchema = {
  label: 'До / после (слайдер)',
  category: 'media',
  fields: BEFOREAFTER_FIELDS,
  defaultProps: BEFOREAFTER_DEFAULT_PROPS,
};

const BEFOREAFTERTABS_SCHEMA: CuratedBlockSchema = {
  label: 'До / после (переключатель)',
  category: 'media',
  fields: BEFOREAFTER_FIELDS,
  defaultProps: BEFOREAFTER_DEFAULT_PROPS,
};

// Competitor-widget-library batch 3 — media.

const LIGHTBOX_FIELDS: Record<string, CuratedField> = {
  images: {
    kind: 'list',
    maxItems: 24,
    itemFields: {
      url: { kind: 'mediaAsset' },
      caption: { kind: 'string', maxLength: 150 },
    },
  },
  columns: { kind: 'number', min: 2, max: 5 },
};

const LIGHTBOX_DEFAULT_PROPS: Record<string, unknown> = {
  images: [
    { url: null, caption: '' },
    { url: null, caption: '' },
    { url: null, caption: '' },
  ],
  columns: 3,
};

const GALLERYLIGHTBOX_SCHEMA: CuratedBlockSchema = {
  label: 'Галерея с просмотром',
  category: 'media',
  fields: LIGHTBOX_FIELDS,
  defaultProps: LIGHTBOX_DEFAULT_PROPS,
};

const GALLERYLIGHTBOXMASONRY_SCHEMA: CuratedBlockSchema = {
  label: 'Галерея-плитка с просмотром',
  category: 'media',
  fields: LIGHTBOX_FIELDS,
  defaultProps: LIGHTBOX_DEFAULT_PROPS,
};

const IMAGEHOTSPOT_SCHEMA: CuratedBlockSchema = {
  label: 'Изображение с метками',
  category: 'media',
  fields: {
    image: { kind: 'mediaAsset' },
    hotspots: {
      kind: 'list',
      maxItems: 10,
      itemFields: {
        x: { kind: 'number', min: 0, max: 100 },
        y: { kind: 'number', min: 0, max: 100 },
        label: { kind: 'string', maxLength: 100 },
        description: { kind: 'string', maxLength: 300 },
      },
    },
  },
  defaultProps: {
    image: null,
    hotspots: [
      { x: 30, y: 40, label: 'Материал', description: 'Натуральное дерево, ручная обработка.' },
      { x: 70, y: 60, label: 'Фурнитура', description: 'Металлические детали премиум-класса.' },
    ],
  },
};

const VIDEOGALLERY_SCHEMA: CuratedBlockSchema = {
  label: 'Галерея видео',
  category: 'media',
  fields: {
    items: {
      kind: 'list',
      maxItems: 12,
      itemFields: {
        embedUrl: { kind: 'string', maxLength: 500 },
        caption: { kind: 'string', maxLength: 150 },
      },
    },
    columns: { kind: 'number', min: 1, max: 3 },
  },
  defaultProps: {
    items: [
      { embedUrl: '', caption: 'Видео 1' },
      { embedUrl: '', caption: 'Видео 2' },
    ],
    columns: 2,
  },
};

const AUDIOEMBED_SCHEMA: CuratedBlockSchema = {
  label: 'Аудио',
  category: 'media',
  fields: {
    embedUrl: { kind: 'string', maxLength: 500 },
    height: { kind: 'number', min: 80, max: 400 },
    caption: { kind: 'string', maxLength: 150 },
  },
  defaultProps: { embedUrl: '', height: 152, caption: '' },
};

const IMAGECAPTION_ALIGN_VALUES = ['left', 'center', 'right'] as const;

const IMAGECAPTION_SCHEMA: CuratedBlockSchema = {
  label: 'Фото с подписью поверх',
  category: 'media',
  fields: {
    image: { kind: 'mediaAsset' },
    eyebrow: { kind: 'string', maxLength: 60 },
    caption: { kind: 'string', maxLength: 200 },
    align: { kind: 'enum', values: IMAGECAPTION_ALIGN_VALUES },
  },
  defaultProps: {
    image: null,
    eyebrow: '',
    caption: 'Ваша история начинается здесь',
    align: 'left',
  },
};

// --- Actions ---------------------------------------------------------------

const BUTTON_VARIANT_VALUES = ['solid', 'outline', 'soft'] as const;

/** Намеренно БЕЗ необязательного `icon?: string` — иконка кнопки не
 * существенна для того, чтобы кнопка работала; пропущенное необязательное
 * поле остаётся `undefined`, тот же штатный путь, что и у кнопки, добавленной
 * вручную без иконки. */
const BUTTON_SCHEMA: CuratedBlockSchema = {
  label: 'Кнопка',
  category: 'actions',
  fields: {
    label: { kind: 'string', maxLength: 60 },
    url: { kind: 'linkTarget' },
    variant: { kind: 'enum', values: BUTTON_VARIANT_VALUES },
    size: { kind: 'enum', values: ['sm', 'md', 'lg'] },
    target: { kind: 'enum', values: ['_self', '_blank'] },
  },
  defaultProps: {
    label: 'Узнать больше',
    url: EMPTY_LINK_TARGET,
    variant: 'solid',
    size: 'md',
    target: '_self',
  },
};

const BUTTONGROUP_SCHEMA: CuratedBlockSchema = {
  label: 'Группа кнопок',
  category: 'actions',
  fields: {
    buttons: {
      kind: 'list',
      maxItems: 4,
      itemFields: {
        label: { kind: 'string', maxLength: 60 },
        url: { kind: 'linkTarget' },
        variant: { kind: 'enum', values: BUTTON_VARIANT_VALUES },
      },
    },
  },
  defaultProps: {
    buttons: [
      { label: 'Записаться', url: EMPTY_LINK_TARGET, variant: 'solid' },
      { label: 'Узнать больше', url: EMPTY_LINK_TARGET, variant: 'outline' },
    ],
  },
};

const LINK_SCHEMA: CuratedBlockSchema = {
  label: 'Ссылка',
  category: 'actions',
  fields: {
    label: { kind: 'string', maxLength: 100 },
    url: { kind: 'linkTarget' },
    target: { kind: 'enum', values: ['_self', '_blank'] },
  },
  defaultProps: { label: 'Подробнее →', url: EMPTY_LINK_TARGET, target: '_self' },
};

const CTA_SCHEMA: CuratedBlockSchema = {
  label: 'Призыв к действию',
  category: 'actions',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Готовы начать?',
    description: 'Свяжитесь с нами — ответим в течение дня.',
    buttonLabel: 'Связаться',
    buttonUrl: EMPTY_LINK_TARGET,
  },
};

// --- Business --------------------------------------------------------------

const NAV_LINKS_FIELD = (maxItems: number): CuratedField => ({
  kind: 'list',
  maxItems,
  itemFields: {
    label: { kind: 'string', maxLength: 60 },
    url: { kind: 'linkTarget' },
  },
});

const BUSINESSHEADER_SCHEMA: CuratedBlockSchema = {
  label: 'Шапка сайта',
  category: 'business',
  fields: { navLinks: NAV_LINKS_FIELD(6) },
  defaultProps: {
    navLinks: [
      { label: 'О нас', url: { type: 'anchor', anchor: 'about' } },
      { label: 'Услуги', url: { type: 'anchor', anchor: 'services' } },
      { label: 'Контакты', url: { type: 'anchor', anchor: 'contact' } },
    ],
  },
};

const HERO_SCHEMA: CuratedBlockSchema = {
  label: 'Главный экран',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    backgroundImage: { kind: 'mediaAsset' },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
    secondaryLabel: { kind: 'string', maxLength: 60 },
    secondaryUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Название вашего бизнеса',
    description: 'Короткое и цепляющее описание того, чем вы занимаетесь.',
    backgroundImage: null,
    buttonLabel: 'Связаться с нами',
    buttonUrl: { type: 'anchor', anchor: 'contact' },
    secondaryLabel: '',
    secondaryUrl: EMPTY_LINK_TARGET,
  },
};

const HEROVIDEO_SCHEMA: CuratedBlockSchema = {
  label: 'Главный экран с видео',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    videoUrl: { kind: 'string', maxLength: 500 },
    posterImage: { kind: 'mediaAsset' },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
    secondaryLabel: { kind: 'string', maxLength: 60 },
    secondaryUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Ощутите разницу с первого дня',
    description: 'Видео-фон сразу передаёт атмосферу — движение, эмоцию, реальный процесс работы.',
    videoUrl: '',
    posterImage: null,
    buttonLabel: 'Связаться с нами',
    buttonUrl: { type: 'anchor', anchor: 'contact' },
    secondaryLabel: '',
    secondaryUrl: EMPTY_LINK_TARGET,
  },
};

const HEROSPLITFORM_SCHEMA: CuratedBlockSchema = {
  label: 'Главный экран с формой',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    formHeading: { kind: 'string', maxLength: 100 },
    formDescription: { kind: 'string', maxLength: 300 },
    fields: {
      kind: 'list',
      maxItems: 6,
      itemFields: {
        label: { kind: 'string', maxLength: 100 },
        type: { kind: 'enum', values: ['text', 'email', 'textarea'] },
      },
    },
    submitLabel: { kind: 'string', maxLength: 60 },
    successMessage: { kind: 'string', maxLength: 300 },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Готовы начать?',
    description: 'Оставьте заявку — мы свяжемся с вами в течение рабочего дня.',
    formHeading: 'Оставить заявку',
    formDescription: '',
    fields: [
      { label: 'Имя', type: 'text' },
      { label: 'Email', type: 'email' },
    ],
    submitLabel: 'Отправить',
    successMessage: 'Спасибо! Мы скоро свяжемся с вами.',
  },
};

const DUALCTA_SCHEMA: CuratedBlockSchema = {
  label: 'Два пути',
  category: 'business',
  fields: {
    heading: { kind: 'string', maxLength: 200 },
    paths: {
      kind: 'list',
      maxItems: 2,
      itemFields: {
        icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
        eyebrow: { kind: 'string', maxLength: 60 },
        heading: { kind: 'string', maxLength: 150 },
        description: { kind: 'string', maxLength: 300 },
        buttonLabel: { kind: 'string', maxLength: 60 },
        buttonUrl: { kind: 'linkTarget' },
      },
    },
  },
  defaultProps: {
    heading: 'Выберите, что вам подходит',
    paths: [
      {
        icon: 'briefcase',
        eyebrow: '',
        heading: 'Для бизнеса',
        description: 'Решения для компаний любого размера.',
        buttonLabel: 'Для бизнеса',
        buttonUrl: EMPTY_LINK_TARGET,
      },
      {
        icon: 'star',
        eyebrow: '',
        heading: 'Для частных лиц',
        description: 'Простые тарифы для личного использования.',
        buttonLabel: 'Для себя',
        buttonUrl: EMPTY_LINK_TARGET,
      },
    ],
  },
};

const ABOUT_SCHEMA: CuratedBlockSchema = {
  label: 'О нас',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    text: { kind: 'string', maxLength: 2000 },
    image: { kind: 'mediaAsset' },
  },
  defaultProps: {
    eyebrow: 'О нас',
    heading: 'Почему выбирают нас',
    text: 'Расскажите историю бизнеса, ваши ценности и то, что делает вас особенными.',
    image: null,
  },
};

const ICON_ITEMS_FIELD = (maxItems?: number): CuratedField => ({
  kind: 'list',
  maxItems,
  itemFields: {
    icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
    title: { kind: 'string', maxLength: 100 },
    description: { kind: 'string', maxLength: 300 },
  },
});

const SERVICES_SCHEMA: CuratedBlockSchema = {
  label: 'Услуги',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: ICON_ITEMS_FIELD(),
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: 'Услуги',
    heading: 'Что мы предлагаем',
    description: '',
    items: [
      { icon: 'star', title: 'Первая услуга', description: 'Короткое описание услуги.' },
      { icon: 'heart', title: 'Вторая услуга', description: 'Короткое описание услуги.' },
      { icon: 'shield', title: 'Третья услуга', description: 'Короткое описание услуги.' },
    ],
    columns: 3,
  },
};

const SERVICECARD_SCHEMA: CuratedBlockSchema = {
  label: 'Карточка услуги',
  category: 'business',
  fields: {
    icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
    title: { kind: 'string', maxLength: 100 },
    description: { kind: 'string', maxLength: 300 },
    price: { kind: 'string', maxLength: 60 },
  },
  defaultProps: {
    icon: 'star',
    title: 'Название услуги',
    description: 'Описание услуги.',
    price: '',
  },
};

const PRICING_SCHEMA: CuratedBlockSchema = {
  label: 'Тарифы',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    plans: {
      kind: 'list',
      maxItems: 4,
      itemFields: {
        name: { kind: 'string', maxLength: 60 },
        price: { kind: 'string', maxLength: 40 },
        period: { kind: 'string', maxLength: 20 },
        features: {
          kind: 'list',
          maxItems: 12,
          itemFields: { text: { kind: 'string', maxLength: 200 } },
        },
        highlighted: { kind: 'boolean' },
        buttonLabel: { kind: 'string', maxLength: 60 },
        buttonUrl: { kind: 'linkTarget' },
      },
    },
  },
  defaultProps: {
    eyebrow: 'Тарифы',
    heading: 'Выберите подходящий вариант',
    description: '',
    plans: [
      {
        name: 'Базовый',
        price: '₴990',
        period: 'мес',
        features: [{ text: 'Основные возможности' }, { text: 'Поддержка по email' }],
        highlighted: false,
        buttonLabel: 'Выбрать',
        buttonUrl: EMPTY_LINK_TARGET,
      },
      {
        name: 'Продвинутый',
        price: '₴2 490',
        period: 'мес',
        features: [
          { text: 'Всё из «Базового»' },
          { text: 'Приоритетная поддержка' },
          { text: 'Расширенные функции' },
        ],
        highlighted: true,
        buttonLabel: 'Выбрать',
        buttonUrl: EMPTY_LINK_TARGET,
      },
    ],
  },
};

const PRICINGTOGGLE_SCHEMA: CuratedBlockSchema = {
  label: 'Тарифы с переключателем',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    monthlyLabel: { kind: 'string', maxLength: 40 },
    yearlyLabel: { kind: 'string', maxLength: 40 },
    yearlyHint: { kind: 'string', maxLength: 20 },
    plans: {
      kind: 'list',
      maxItems: 4,
      itemFields: {
        name: { kind: 'string', maxLength: 60 },
        priceMonthly: { kind: 'string', maxLength: 40 },
        priceYearly: { kind: 'string', maxLength: 40 },
        features: {
          kind: 'list',
          maxItems: 12,
          itemFields: { text: { kind: 'string', maxLength: 200 } },
        },
        highlighted: { kind: 'boolean' },
        buttonLabel: { kind: 'string', maxLength: 60 },
        buttonUrl: { kind: 'linkTarget' },
      },
    },
  },
  defaultProps: {
    eyebrow: 'Тарифы',
    heading: 'Выберите подходящий вариант',
    description: '',
    monthlyLabel: 'Помесячно',
    yearlyLabel: 'За год',
    yearlyHint: '-20%',
    plans: [
      {
        name: 'Базовый',
        priceMonthly: '₴990/мес',
        priceYearly: '₴9 500/год',
        features: [{ text: 'Основные возможности' }, { text: 'Поддержка по email' }],
        highlighted: false,
        buttonLabel: 'Выбрать',
        buttonUrl: EMPTY_LINK_TARGET,
      },
      {
        name: 'Продвинутый',
        priceMonthly: '₴2 490/мес',
        priceYearly: '₴23 900/год',
        features: [
          { text: 'Всё из «Базового»' },
          { text: 'Приоритетная поддержка' },
          { text: 'Расширенные функции' },
        ],
        highlighted: true,
        buttonLabel: 'Выбрать',
        buttonUrl: EMPTY_LINK_TARGET,
      },
    ],
  },
};

const PRICINGSINGLE_SCHEMA: CuratedBlockSchema = {
  label: 'Один тариф',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    name: { kind: 'string', maxLength: 60 },
    price: { kind: 'string', maxLength: 40 },
    period: { kind: 'string', maxLength: 20 },
    features: {
      kind: 'list',
      maxItems: 12,
      itemFields: { text: { kind: 'string', maxLength: 200 } },
    },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    eyebrow: 'Тариф',
    heading: 'Всё включено',
    description: '',
    name: 'Единый пакет',
    price: '₴1 990',
    period: 'мес',
    features: [
      { text: 'Все возможности без ограничений' },
      { text: 'Поддержка 24/7' },
      { text: 'Отмена в любой момент' },
    ],
    buttonLabel: 'Оформить',
    buttonUrl: EMPTY_LINK_TARGET,
  },
};

const PRICINGCALCULATOR_SCHEMA: CuratedBlockSchema = {
  label: 'Калькулятор цены',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    unitLabel: { kind: 'string', maxLength: 60 },
    basePrice: { kind: 'number', min: 0 },
    pricePerUnit: { kind: 'number', min: 0 },
    minUnits: { kind: 'number', min: 0 },
    maxUnits: { kind: 'number', min: 1 },
    defaultUnits: { kind: 'number', min: 0 },
    currencySuffix: { kind: 'string', maxLength: 10 },
    periodLabel: { kind: 'string', maxLength: 20 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    eyebrow: 'Тарифы',
    heading: 'Посчитайте свою цену',
    description: '',
    unitLabel: 'пользователей',
    basePrice: 490,
    pricePerUnit: 90,
    minUnits: 1,
    maxUnits: 50,
    defaultUnits: 5,
    currencySuffix: '₴',
    periodLabel: 'мес',
    buttonLabel: 'Начать',
    buttonUrl: EMPTY_LINK_TARGET,
  },
};

const PEOPLE_ITEMS_FIELD = (withRating: boolean): CuratedField => ({
  kind: 'list',
  itemFields: {
    photo: { kind: 'mediaAsset' },
    name: { kind: 'string', maxLength: 100 },
    role: { kind: 'string', maxLength: 100 },
    text: { kind: 'string', maxLength: 500 },
    ...(withRating ? { rating: { kind: 'number' as const, min: 1, max: 5 } } : {}),
  },
});

const TEAM_SCHEMA: CuratedBlockSchema = {
  label: 'Команда',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: PEOPLE_ITEMS_FIELD(false),
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: 'Команда',
    heading: 'Кто с вами работает',
    description: '',
    items: [
      { photo: null, name: 'Имя Фамилия', role: 'Должность', text: '' },
      { photo: null, name: 'Имя Фамилия', role: 'Должность', text: '' },
      { photo: null, name: 'Имя Фамилия', role: 'Должность', text: '' },
    ],
    columns: 3,
  },
};

const TEAMMEMBER_SCHEMA: CuratedBlockSchema = {
  label: 'Карточка сотрудника',
  category: 'business',
  fields: {
    photo: { kind: 'mediaAsset' },
    name: { kind: 'string', maxLength: 100 },
    role: { kind: 'string', maxLength: 100 },
    text: { kind: 'string', maxLength: 500 },
  },
  defaultProps: { photo: null, name: 'Имя Фамилия', role: 'Должность', text: '' },
};

const TEAMSOCIAL_SCHEMA: CuratedBlockSchema = {
  label: 'Команда с соцсетями',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: {
      kind: 'list',
      itemFields: {
        photo: { kind: 'mediaAsset' },
        name: { kind: 'string', maxLength: 100 },
        role: { kind: 'string', maxLength: 100 },
        text: { kind: 'string', maxLength: 500 },
        socialLinks: {
          kind: 'list',
          maxItems: 4,
          itemFields: {
            platform: { kind: 'string', maxLength: 40 },
            url: { kind: 'string', maxLength: 300 },
          },
        },
      },
    },
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: 'Команда',
    heading: 'Кто с вами работает',
    description: '',
    items: [
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Должность',
        text: '',
        socialLinks: [{ platform: 'LinkedIn', url: '' }],
      },
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Должность',
        text: '',
        socialLinks: [{ platform: 'LinkedIn', url: '' }],
      },
    ],
    columns: 3,
  },
};

const TESTIMONIALS_SCHEMA: CuratedBlockSchema = {
  label: 'Отзывы клиентов',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: PEOPLE_ITEMS_FIELD(false),
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: 'Отзывы',
    heading: 'Что говорят клиенты',
    description: '',
    items: [
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Клиент',
        text: 'Отличный сервис, обязательно вернусь ещё!',
      },
      { photo: null, name: 'Имя Фамилия', role: 'Клиент', text: 'Очень довольны результатом.' },
    ],
    columns: 2,
  },
};

const REVIEWS_SCHEMA: CuratedBlockSchema = {
  label: 'Оценки и отзывы',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: PEOPLE_ITEMS_FIELD(true),
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: 'Отзывы',
    heading: 'Нас рекомендуют',
    description: '',
    items: [
      {
        photo: null,
        name: 'Имя Фамилия',
        role: '',
        text: 'Прекрасное место, всё понравилось.',
        rating: 5,
      },
      {
        photo: null,
        name: 'Имя Фамилия',
        role: '',
        text: 'Хороший опыт, буду обращаться снова.',
        rating: 4,
      },
    ],
    columns: 2,
  },
};

const TESTIMONIALWALL_SCHEMA: CuratedBlockSchema = {
  label: 'Стена отзывов',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: PEOPLE_ITEMS_FIELD(false),
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: 'Отзывы',
    heading: 'Нам доверяют',
    description: '',
    items: [
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Клиент',
        text: 'Очень довольны сотрудничеством, всё чётко и в срок.',
      },
      { photo: null, name: 'Имя Фамилия', role: 'Клиент', text: 'Рекомендую!' },
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Клиент',
        text: 'Приятно удивлены качеством и вниманием к деталям — обязательно обратимся снова.',
      },
      { photo: null, name: 'Имя Фамилия', role: 'Клиент', text: 'Хороший сервис.' },
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Клиент',
        text: 'Отличная команда, всё понравилось от первого звонка до результата.',
      },
      { photo: null, name: 'Имя Фамилия', role: 'Клиент', text: 'Спасибо за помощь!' },
    ],
    columns: 3,
  },
};

const RATINGSUMMARY_SCHEMA: CuratedBlockSchema = {
  label: 'Сводка оценок',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    averageRating: { kind: 'number', min: 0, max: 5 },
    totalReviews: { kind: 'number', min: 0 },
    breakdown: {
      kind: 'list',
      maxItems: 5,
      itemFields: {
        stars: { kind: 'number', min: 1, max: 5 },
        percent: { kind: 'number', min: 0, max: 100 },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Нас оценивают',
    averageRating: 4.8,
    totalReviews: 230,
    breakdown: [
      { stars: 5, percent: 78 },
      { stars: 4, percent: 15 },
      { stars: 3, percent: 5 },
      { stars: 2, percent: 1 },
      { stars: 1, percent: 1 },
    ],
  },
};

const PLATFORMRATINGS_SCHEMA: CuratedBlockSchema = {
  label: 'Оценки по площадкам',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      maxItems: 6,
      itemFields: {
        platform: { kind: 'string', maxLength: 60 },
        rating: { kind: 'number', min: 0, max: 5 },
        count: { kind: 'number', min: 0 },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Нас оценивают',
    items: [
      { platform: 'Google', rating: 4.8, count: 230 },
      { platform: 'Facebook', rating: 4.9, count: 150 },
    ],
  },
};

const FAQ_SCHEMA: CuratedBlockSchema = {
  label: 'Вопросы и ответы',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      itemFields: {
        question: { kind: 'string', maxLength: 200 },
        answer: { kind: 'string', maxLength: 1000 },
      },
    },
  },
  defaultProps: {
    eyebrow: 'FAQ',
    heading: 'Частые вопросы',
    items: [
      { question: 'Как записаться?', answer: 'Позвоните нам или заполните форму на сайте.' },
      { question: 'Какие способы оплаты?', answer: 'Принимаем карты и наличные.' },
    ],
  },
};

const FAQTABS_SCHEMA: CuratedBlockSchema = {
  label: 'Вопросы по категориям',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    categories: {
      kind: 'list',
      maxItems: 6,
      itemFields: {
        label: { kind: 'string', maxLength: 60 },
        items: {
          kind: 'list',
          itemFields: {
            question: { kind: 'string', maxLength: 200 },
            answer: { kind: 'string', maxLength: 1000 },
          },
        },
      },
    },
  },
  defaultProps: {
    eyebrow: 'FAQ',
    heading: 'Частые вопросы',
    categories: [
      {
        label: 'Доставка',
        items: [
          { question: 'Как быстро доставляете?', answer: 'В течение 1-2 дней по городу.' },
          { question: 'Есть ли самовывоз?', answer: 'Да, забрать заказ можно в шоуруме.' },
        ],
      },
      {
        label: 'Оплата',
        items: [
          { question: 'Какие способы оплаты?', answer: 'Принимаем карты и наличные.' },
          { question: 'Можно ли в рассрочку?', answer: 'Да, доступна рассрочка на 3 месяца.' },
        ],
      },
      {
        label: 'Возврат',
        items: [
          { question: 'Как оформить возврат?', answer: 'Свяжитесь с нами в течение 14 дней.' },
        ],
      },
    ],
  },
};

const ACCORDIONLIST_SCHEMA: CuratedBlockSchema = {
  label: 'Аккордеон',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      itemFields: {
        title: { kind: 'string', maxLength: 150 },
        content: { kind: 'string', maxLength: 1000 },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Что входит',
    items: [
      { title: 'Состав набора', content: 'Опишите, что именно входит в этот раздел.' },
      { title: 'Материалы', content: 'Расскажите про материалы или технологию.' },
      { title: 'Уход', content: 'Дайте рекомендации по уходу или использованию.' },
    ],
  },
};

const FAQSEARCH_SCHEMA: CuratedBlockSchema = {
  label: 'Вопросы с поиском',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    placeholder: { kind: 'string', maxLength: 100 },
    emptyText: { kind: 'string', maxLength: 150 },
    items: {
      kind: 'list',
      itemFields: {
        question: { kind: 'string', maxLength: 200 },
        answer: { kind: 'string', maxLength: 1000 },
      },
    },
  },
  defaultProps: {
    eyebrow: 'FAQ',
    heading: 'Частые вопросы',
    placeholder: 'Поиск по вопросам…',
    emptyText: 'Ничего не найдено — попробуйте другой запрос',
    items: [
      {
        question: 'Как оформить заказ?',
        answer: 'Добавьте товар в корзину и оформите заказ на сайте.',
      },
      { question: 'Какие способы оплаты?', answer: 'Принимаем карты и наличные при получении.' },
      {
        question: 'Как оформить возврат?',
        answer: 'Свяжитесь с нами в течение 14 дней после покупки.',
      },
    ],
  },
};

const CONTACT_SCHEMA: CuratedBlockSchema = {
  label: 'Контакты',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
  },
  defaultProps: { eyebrow: 'Контакты', heading: 'Свяжитесь с нами', description: '' },
};

const OPENINGHOURS_SCHEMA: CuratedBlockSchema = {
  label: 'Часы работы',
  category: 'business',
  fields: {
    heading: { kind: 'string', maxLength: 200 },
    rows: {
      kind: 'list',
      maxItems: 7,
      itemFields: {
        day: { kind: 'string', maxLength: 60 },
        hours: { kind: 'string', maxLength: 60 },
      },
    },
  },
  defaultProps: {
    heading: 'Часы работы',
    rows: [
      { day: 'Понедельник — пятница', hours: '9:00 – 19:00' },
      { day: 'Суббота', hours: '10:00 – 17:00' },
      { day: 'Воскресенье', hours: 'Выходной' },
    ],
  },
};

const LOCATION_SCHEMA: CuratedBlockSchema = {
  label: 'Расположение',
  category: 'business',
  fields: {
    heading: { kind: 'string', maxLength: 200 },
    mapEmbedUrl: { kind: 'string', maxLength: 2000 },
  },
  defaultProps: { heading: 'Где нас найти', mapEmbedUrl: '' },
};

/** Не имеет `businessId`-подобного поля, привязывающего к реальным
 * `Business.workingHours` — этот блок вообще без своей «настоящей» части
 * данных, только текстовые подписи для трёх состояний (см. `businesshours`
 * во frontend-реестре, `blocks/business/index.tsx`): часы работы читаются
 * из карточки бизнеса на клиенте, не хранятся здесь и не проверяются этой
 * схемой. */
const BUSINESSHOURS_SCHEMA: CuratedBlockSchema = {
  label: 'Статус «Открыто/Закрыто»',
  category: 'business',
  fields: {
    openLabel: { kind: 'string', maxLength: 60 },
    closedLabel: { kind: 'string', maxLength: 60 },
    unknownLabel: { kind: 'string', maxLength: 60 },
    showHours: { kind: 'boolean' },
  },
  defaultProps: {
    openLabel: 'Открыто сейчас',
    closedLabel: 'Сейчас закрыто',
    unknownLabel: 'Часы работы не указаны',
    showHours: true,
  },
};

const LOCATIONSLIST_SCHEMA: CuratedBlockSchema = {
  label: 'Список филиалов',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    locations: {
      kind: 'list',
      itemFields: {
        name: { kind: 'string', maxLength: 100 },
        address: { kind: 'string', maxLength: 200 },
        phone: { kind: 'string', maxLength: 40 },
        hours: { kind: 'string', maxLength: 100 },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Наши филиалы',
    locations: [
      {
        name: 'Центральный офис',
        address: 'ул. Примерная, 1',
        phone: '380501234567',
        hours: 'Пн–Пт 9:00–19:00',
      },
      {
        name: 'Филиал на Левом берегу',
        address: 'ул. Вторая, 22',
        phone: '380501234568',
        hours: 'Пн–Сб 10:00–20:00',
      },
    ],
  },
};

/** Без своего адреса в `fields` — тот же принцип, что у `businesshours`
 * выше: настоящий адрес читается из `business.address` на клиенте, здесь
 * только текст кнопки. */
const GETDIRECTIONS_SCHEMA: CuratedBlockSchema = {
  label: 'Проложить маршрут',
  category: 'business',
  fields: {
    buttonLabel: { kind: 'string', maxLength: 60 },
  },
  defaultProps: { buttonLabel: 'Проложить маршрут' },
};

const SOCIALLINKS_SCHEMA: CuratedBlockSchema = {
  label: 'Соцсети',
  category: 'business',
  fields: {},
  defaultProps: {},
};

const SOCIALSHARE_SCHEMA: CuratedBlockSchema = {
  label: 'Поделиться страницей',
  category: 'business',
  fields: {
    heading: { kind: 'string', maxLength: 150 },
    showFacebook: { kind: 'boolean' },
    showTwitter: { kind: 'boolean' },
    showLinkedin: { kind: 'boolean' },
    showTelegram: { kind: 'boolean' },
    showCopyLink: { kind: 'boolean' },
  },
  defaultProps: {
    heading: 'Поделитесь этой страницей',
    showFacebook: true,
    showTwitter: true,
    showLinkedin: false,
    showTelegram: true,
    showCopyLink: true,
  },
};

const NATIVESHAREBUTTON_SCHEMA: CuratedBlockSchema = {
  label: 'Кнопка «Поделиться» (системная)',
  category: 'business',
  fields: {
    label: { kind: 'string', maxLength: 60 },
    shareTitle: { kind: 'string', maxLength: 150 },
    shareText: { kind: 'string', maxLength: 300 },
  },
  defaultProps: { label: 'Поделиться', shareTitle: '', shareText: '' },
};

// Competitor-widget-library batch 2 — business.

const TESTIMONIALSSLIDER_SCHEMA: CuratedBlockSchema = {
  label: 'Отзывы (слайдер)',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      maxItems: 10,
      itemFields: {
        photo: { kind: 'mediaAsset' },
        name: { kind: 'string', maxLength: 100 },
        role: { kind: 'string', maxLength: 100 },
        text: { kind: 'string', maxLength: 500 },
        rating: { kind: 'number', min: 0, max: 5 },
      },
    },
    autoPlay: { kind: 'boolean' },
    interval: { kind: 'number', min: 2, max: 15 },
  },
  defaultProps: {
    eyebrow: 'Отзывы',
    heading: 'Что говорят клиенты',
    items: [
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Клиент',
        text: 'Отличный сервис и внимание к деталям.',
        rating: 5,
      },
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Клиент',
        text: 'Рекомендую всем друзьям.',
        rating: 5,
      },
    ],
    autoPlay: true,
    interval: 6,
  },
};

const TEAMSLIDER_SCHEMA: CuratedBlockSchema = {
  label: 'Команда (слайдер)',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      maxItems: 10,
      itemFields: {
        photo: { kind: 'mediaAsset' },
        name: { kind: 'string', maxLength: 100 },
        role: { kind: 'string', maxLength: 100 },
        bio: { kind: 'string', maxLength: 500 },
      },
    },
    autoPlay: { kind: 'boolean' },
    interval: { kind: 'number', min: 2, max: 15 },
  },
  defaultProps: {
    eyebrow: 'Команда',
    heading: 'Знакомьтесь',
    items: [
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Должность',
        bio: 'Короткая история о человеке и его роли в команде.',
      },
      {
        photo: null,
        name: 'Имя Фамилия',
        role: 'Должность',
        bio: 'Короткая история о человеке и его роли в команде.',
      },
    ],
    autoPlay: false,
    interval: 6,
  },
};

const VIDEOTESTIMONIALSLIDER_SCHEMA: CuratedBlockSchema = {
  label: 'Видео-отзывы (слайдер)',
  category: 'business',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      maxItems: 10,
      itemFields: {
        embedUrl: { kind: 'string', maxLength: 500 },
        authorName: { kind: 'string', maxLength: 100 },
        authorRole: { kind: 'string', maxLength: 150 },
      },
    },
    autoPlay: { kind: 'boolean' },
    interval: { kind: 'number', min: 2, max: 15 },
  },
  defaultProps: {
    eyebrow: 'Отзывы',
    heading: 'Видео-отзывы клиентов',
    items: [
      { embedUrl: '', authorName: 'Имя Фамилия', authorRole: 'Клиент' },
      { embedUrl: '', authorName: 'Имя Фамилия', authorRole: 'Клиент' },
    ],
    autoPlay: false,
    interval: 8,
  },
};

const QUOTESPOTLIGHT_SCHEMA: CuratedBlockSchema = {
  label: 'Крупная цитата',
  category: 'business',
  fields: {
    quote: { kind: 'string', maxLength: 400 },
    authorName: { kind: 'string', maxLength: 100 },
    authorRole: { kind: 'string', maxLength: 150 },
  },
  defaultProps: {
    quote: 'Лучшее решение, которое мы приняли в этом году.',
    authorName: 'Имя Фамилия',
    authorRole: 'Генеральный директор, Компания',
  },
};

const VIDEOTESTIMONIAL_SCHEMA: CuratedBlockSchema = {
  label: 'Видео-отзыв',
  category: 'business',
  fields: {
    embedUrl: { kind: 'string', maxLength: 500 },
    authorName: { kind: 'string', maxLength: 100 },
    authorRole: { kind: 'string', maxLength: 150 },
  },
  defaultProps: {
    embedUrl: '',
    authorName: 'Имя Фамилия',
    authorRole: 'Клиент',
  },
};

const SOCIALPROOFBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Полоса доверия',
  category: 'business',
  fields: {
    avatars: {
      kind: 'list',
      maxItems: 6,
      itemFields: { photo: { kind: 'mediaAsset' } },
    },
    rating: { kind: 'number', min: 0, max: 5 },
    ratingText: { kind: 'string', maxLength: 150 },
  },
  defaultProps: {
    avatars: [{ photo: null }, { photo: null }, { photo: null }, { photo: null }],
    rating: 4.9,
    ratingText: '500+ довольных клиентов',
  },
};

// --- Content -----------------------------------------------------------

const FEATUREGRID_SCHEMA: CuratedBlockSchema = {
  label: 'Преимущества',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: ICON_ITEMS_FIELD(),
    columns: { kind: 'number', min: 2, max: 4 },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Почему с нами удобно',
    description: '',
    items: [
      { icon: 'check', title: 'Быстро', description: 'Отвечаем в течение часа.' },
      { icon: 'shield', title: 'Надёжно', description: 'Гарантия на все работы.' },
      { icon: 'heart', title: 'С заботой', description: 'Индивидуальный подход к каждому.' },
      { icon: 'star', title: 'Качественно', description: 'Только проверенные материалы.' },
    ],
    columns: 4,
  },
};

const SIMPLE_CARDS_FIELDS = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  description: { kind: 'string', maxLength: 400 },
  items: {
    kind: 'list',
    itemFields: {
      image: { kind: 'mediaAsset' },
      title: { kind: 'string', maxLength: 150 },
      description: { kind: 'string', maxLength: 400 },
      meta: { kind: 'string', maxLength: 100 },
      url: { kind: 'linkTarget' },
    },
  },
  columns: { kind: 'number', min: 2, max: 4 },
});

const CARDS_SCHEMA: CuratedBlockSchema = {
  label: 'Карточки',
  category: 'content',
  fields: SIMPLE_CARDS_FIELDS(),
  defaultProps: {
    eyebrow: '',
    heading: 'Может пригодиться',
    description: '',
    items: [
      {
        image: null,
        title: 'Первая карточка',
        description: 'Короткое описание.',
        meta: '',
        url: EMPTY_LINK_TARGET,
      },
      {
        image: null,
        title: 'Вторая карточка',
        description: 'Короткое описание.',
        meta: '',
        url: EMPTY_LINK_TARGET,
      },
      {
        image: null,
        title: 'Третья карточка',
        description: 'Короткое описание.',
        meta: '',
        url: EMPTY_LINK_TARGET,
      },
    ],
    columns: 3,
  },
};

const ARTICLES_SCHEMA: CuratedBlockSchema = {
  label: 'Статьи и новости',
  category: 'content',
  fields: SIMPLE_CARDS_FIELDS(),
  defaultProps: {
    eyebrow: 'Блог',
    heading: 'Последние новости',
    description: '',
    items: [
      {
        image: null,
        title: 'Заголовок статьи',
        description: 'Короткий анонс.',
        meta: '1 марта 2026',
        url: EMPTY_LINK_TARGET,
      },
      {
        image: null,
        title: 'Заголовок статьи',
        description: 'Короткий анонс.',
        meta: '20 февраля 2026',
        url: EMPTY_LINK_TARGET,
      },
    ],
    columns: 3,
  },
};

const STATS_SCHEMA: CuratedBlockSchema = {
  label: 'Цифры и факты',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: {
      kind: 'list',
      maxItems: 5,
      itemFields: {
        number: { kind: 'string', maxLength: 20 },
        label: { kind: 'string', maxLength: 100 },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: '',
    items: [
      { number: '10+', label: 'лет на рынке' },
      { number: '500+', label: 'довольных клиентов' },
      { number: '24/7', label: 'поддержка' },
    ],
  },
};

const BANNER_SCHEMA: CuratedBlockSchema = {
  label: 'Объявление',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 200 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    text: 'Скидка 20% до конца месяца',
    buttonLabel: 'Подробнее',
    buttonUrl: EMPTY_LINK_TARGET,
  },
};

// Виджеты ниже (timeline/tabs/countdown/logocloud/comparison) добавлены
// партией «библиотека виджетов конкурентов» — каждая пара из двух схем
// сверена 1:1 с общим движком (`XxxFields`/`XxxDefaultProps`) двух
// одноимённых frontend-типов (`blocks/content/index.tsx`), тот же приём,
// что уже был у `team`/`teammember`/`testimonials` (`PEOPLE_ITEMS_FIELD`)
// выше по файлу — общий `fields`/`defaultProps`, разные `type`/`label`.

const TIMELINE_FIELDS = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  description: { kind: 'string', maxLength: 400 },
  items: {
    kind: 'list',
    maxItems: 8,
    itemFields: {
      date: { kind: 'string', maxLength: 40 },
      title: { kind: 'string', maxLength: 150 },
      description: { kind: 'string', maxLength: 400 },
    },
  },
});

const TIMELINE_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: 'Как всё было',
  heading: 'Наш путь',
  description: '',
  items: [
    { date: '2020', title: 'Основание компании', description: 'Начали с небольшой команды.' },
    { date: '2022', title: 'Первые 100 клиентов', description: 'Вышли на новый рынок.' },
    { date: '2024', title: 'Открыли второй офис', description: 'Расширили команду вдвое.' },
    { date: '2026', title: 'Мы сегодня', description: 'Продолжаем расти вместе с вами.' },
  ],
};

const TIMELINE_SCHEMA: CuratedBlockSchema = {
  label: 'Хронология',
  category: 'content',
  fields: TIMELINE_FIELDS(),
  defaultProps: TIMELINE_DEFAULT_PROPS,
};

const TIMELINESIMPLE_SCHEMA: CuratedBlockSchema = {
  label: 'Хронология (список)',
  category: 'content',
  fields: TIMELINE_FIELDS(),
  defaultProps: TIMELINE_DEFAULT_PROPS,
};

const TIMELINEMEDIA_SCHEMA: CuratedBlockSchema = {
  label: 'Хронология с фото',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    items: {
      kind: 'list',
      maxItems: 8,
      itemFields: {
        image: { kind: 'mediaAsset' },
        date: { kind: 'string', maxLength: 40 },
        title: { kind: 'string', maxLength: 150 },
        description: { kind: 'string', maxLength: 400 },
      },
    },
  },
  defaultProps: {
    eyebrow: 'Как всё было',
    heading: 'Наш путь',
    description: '',
    items: [
      {
        image: null,
        date: '2020',
        title: 'Основание компании',
        description: 'Начали с небольшой команды.',
      },
      {
        image: null,
        date: '2022',
        title: 'Первые 100 клиентов',
        description: 'Вышли на новый рынок.',
      },
      {
        image: null,
        date: '2024',
        title: 'Открыли второй офис',
        description: 'Расширили команду вдвое.',
      },
    ],
  },
};

const TABS_FIELDS = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  items: {
    kind: 'list',
    maxItems: 6,
    itemFields: {
      label: { kind: 'string', maxLength: 40 },
      title: { kind: 'string', maxLength: 150 },
      content: { kind: 'string', maxLength: 800 },
    },
  },
});

const TABS_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: '',
  heading: 'Полезно знать',
  items: [
    {
      label: 'Доставка',
      title: 'Как доставляем',
      content: 'Доставляем по городу в течение 1-2 дней, по стране — 3-5 дней.',
    },
    {
      label: 'Оплата',
      title: 'Способы оплаты',
      content: 'Принимаем карты, наличные при получении и безналичный расчёт.',
    },
    {
      label: 'Возврат',
      title: 'Условия возврата',
      content: 'Возврат возможен в течение 14 дней с момента покупки.',
    },
  ],
};

const TABS_SCHEMA: CuratedBlockSchema = {
  label: 'Вкладки',
  category: 'content',
  fields: TABS_FIELDS(),
  defaultProps: TABS_DEFAULT_PROPS,
};

const TABSVERTICAL_SCHEMA: CuratedBlockSchema = {
  label: 'Вкладки (боковые)',
  category: 'content',
  fields: TABS_FIELDS(),
  defaultProps: TABS_DEFAULT_PROPS,
};

const COUNTDOWN_SCHEMA: CuratedBlockSchema = {
  label: 'Обратный отсчёт',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    // Обычная строка, не отдельный `kind: 'date'` — такого вида поля нет ни
    // в этой curated-схеме, ни в frontend `FieldSchema` (см. `registry.ts`),
    // заводить его ради одного блока — за рамками этой партии.
    targetDate: { kind: 'string', maxLength: 40 },
    expiredText: { kind: 'string', maxLength: 100 },
  },
  defaultProps: {
    eyebrow: 'Ограниченное предложение',
    heading: 'Успейте до конца акции',
    description: '',
    targetDate: '2026-12-31T23:59',
    expiredText: 'Акция завершена',
  },
};

const COUNTDOWNBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Полоса с таймером',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 200 },
    targetDate: { kind: 'string', maxLength: 40 },
    expiredText: { kind: 'string', maxLength: 100 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    text: 'Скидка 20% заканчивается через',
    targetDate: '2026-12-31T23:59',
    expiredText: 'Скидка 20% закончилась',
    buttonLabel: 'Успеть',
    buttonUrl: EMPTY_LINK_TARGET,
  },
};

const LOGOCLOUD_FIELDS = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  items: {
    kind: 'list',
    maxItems: 12,
    itemFields: {
      image: { kind: 'mediaAsset' },
      name: { kind: 'string', maxLength: 60 },
      url: { kind: 'linkTarget' },
    },
  },
});

const LOGOCLOUD_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: '',
  heading: 'Нам доверяют',
  items: [
    { image: null, name: 'Альфа', url: EMPTY_LINK_TARGET },
    { image: null, name: 'Nord Studio', url: EMPTY_LINK_TARGET },
    { image: null, name: 'Vega Group', url: EMPTY_LINK_TARGET },
    { image: null, name: 'Prime Logistics', url: EMPTY_LINK_TARGET },
    { image: null, name: 'Solaris', url: EMPTY_LINK_TARGET },
    { image: null, name: 'Meridian', url: EMPTY_LINK_TARGET },
  ],
};

const LOGOCLOUD_SCHEMA: CuratedBlockSchema = {
  label: 'Логотипы партнёров',
  category: 'content',
  fields: LOGOCLOUD_FIELDS(),
  defaultProps: LOGOCLOUD_DEFAULT_PROPS,
};

const LOGOCLOUDMARQUEE_SCHEMA: CuratedBlockSchema = {
  label: 'Логотипы (бегущая строка)',
  category: 'content',
  fields: LOGOCLOUD_FIELDS(),
  defaultProps: LOGOCLOUD_DEFAULT_PROPS,
};

const COMPARISON_SCHEMA: CuratedBlockSchema = {
  label: 'Сравнение вариантов',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    plans: {
      kind: 'list',
      maxItems: 4,
      itemFields: {
        name: { kind: 'string', maxLength: 60 },
        highlighted: { kind: 'boolean' },
        features: {
          kind: 'list',
          maxItems: 12,
          itemFields: {
            label: { kind: 'string', maxLength: 150 },
            included: { kind: 'boolean' },
          },
        },
      },
    },
  },
  defaultProps: {
    eyebrow: 'Сравнение',
    heading: 'Что входит в каждый вариант',
    description: '',
    plans: [
      {
        name: 'Стандарт',
        highlighted: false,
        features: [
          { label: 'Базовая поддержка', included: true },
          { label: 'Персональный менеджер', included: false },
          { label: 'Приоритетная очередь', included: false },
          { label: 'Расширенная отчётность', included: false },
        ],
      },
      {
        name: 'Премиум',
        highlighted: true,
        features: [
          { label: 'Базовая поддержка', included: true },
          { label: 'Персональный менеджер', included: true },
          { label: 'Приоритетная очередь', included: true },
          { label: 'Расширенная отчётность', included: true },
        ],
      },
    ],
  },
};

const COMPARISONSPLIT_SCHEMA: CuratedBlockSchema = {
  label: 'Сравнение «мы / другие»',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    oursLabel: { kind: 'string', maxLength: 40 },
    theirsLabel: { kind: 'string', maxLength: 40 },
    rows: {
      kind: 'list',
      maxItems: 10,
      itemFields: {
        label: { kind: 'string', maxLength: 150 },
        ours: { kind: 'boolean' },
        theirs: { kind: 'boolean' },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Почему выбирают нас',
    description: '',
    oursLabel: 'Мы',
    theirsLabel: 'Другие',
    rows: [
      { label: 'Ответ в течение часа', ours: true, theirs: false },
      { label: 'Личный менеджер', ours: true, theirs: false },
      { label: 'Гарантия на работы', ours: true, theirs: true },
      { label: 'Скрытые платежи', ours: false, theirs: true },
      { label: 'Отчёт по итогам', ours: true, theirs: false },
    ],
  },
};

// Competitor-widget-library batch 2 — content.

const PROGRESS_FIELDS: Record<string, CuratedField> = {
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  description: { kind: 'string', maxLength: 400 },
  items: {
    kind: 'list',
    maxItems: 8,
    itemFields: {
      label: { kind: 'string', maxLength: 60 },
      percent: { kind: 'number', min: 0, max: 100 },
    },
  },
};

const PROGRESS_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: '',
  heading: 'Наши сильные стороны',
  description: '',
  items: [
    { label: 'Качество', percent: 95 },
    { label: 'Скорость', percent: 88 },
    { label: 'Сервис', percent: 92 },
  ],
};

const PROGRESSBARS_SCHEMA: CuratedBlockSchema = {
  label: 'Прогресс-бары',
  category: 'content',
  fields: PROGRESS_FIELDS,
  defaultProps: PROGRESS_DEFAULT_PROPS,
};

const PROGRESSCIRCLES_SCHEMA: CuratedBlockSchema = {
  label: 'Прогресс-кольца',
  category: 'content',
  fields: PROGRESS_FIELDS,
  defaultProps: PROGRESS_DEFAULT_PROPS,
};

const STICKYBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Плавающая полоса',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 200 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
    dismissible: { kind: 'boolean' },
  },
  defaultProps: {
    text: 'Специальное предложение — успейте до конца недели',
    buttonLabel: 'Подробнее',
    buttonUrl: EMPTY_LINK_TARGET,
    dismissible: true,
  },
};

const STICKYCOUNTDOWNBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Плавающая полоса с таймером',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 200 },
    targetDate: { kind: 'string', maxLength: 40 },
    expiredText: { kind: 'string', maxLength: 100 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
    dismissible: { kind: 'boolean' },
  },
  defaultProps: {
    text: 'Скидка 20% заканчивается через',
    targetDate: '2026-12-31T23:59',
    expiredText: 'Скидка 20% закончилась',
    buttonLabel: 'Успеть',
    buttonUrl: EMPTY_LINK_TARGET,
    dismissible: true,
  },
};

const POPUPOFFER_SCHEMA: CuratedBlockSchema = {
  label: 'Всплывающее предложение',
  category: 'content',
  fields: {
    heading: { kind: 'string', maxLength: 100 },
    text: { kind: 'string', maxLength: 300 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
    delaySeconds: { kind: 'number', min: 0, max: 60 },
  },
  defaultProps: {
    heading: 'Специальное предложение',
    text: 'Оставьте заявку и получите скидку 10%',
    buttonLabel: 'Хочу скидку',
    buttonUrl: EMPTY_LINK_TARGET,
    delaySeconds: 4,
  },
};

const EXITINTENTPOPUP_SCHEMA: CuratedBlockSchema = {
  label: 'Попап при уходе со страницы',
  category: 'content',
  fields: {
    heading: { kind: 'string', maxLength: 100 },
    text: { kind: 'string', maxLength: 300 },
    buttonLabel: { kind: 'string', maxLength: 60 },
    buttonUrl: { kind: 'linkTarget' },
  },
  defaultProps: {
    heading: 'Подождите!',
    text: 'Прежде чем уйти — заберите скидку 10% на первый заказ',
    buttonLabel: 'Забрать скидку',
    buttonUrl: EMPTY_LINK_TARGET,
  },
};

// Competitor-widget-library batch 3 — content.

const CONTACT_CHANNEL_VALUES = ['whatsapp', 'telegram', 'phone', 'email'] as const;
const CONTACT_POSITION_VALUES = ['bottom-right', 'bottom-left'] as const;

const CONTACTBUBBLE_SCHEMA: CuratedBlockSchema = {
  label: 'Плавающая кнопка связи',
  category: 'content',
  fields: {
    channel: { kind: 'enum', values: CONTACT_CHANNEL_VALUES },
    value: { kind: 'string', maxLength: 150 },
    label: { kind: 'string', maxLength: 60 },
    position: { kind: 'enum', values: CONTACT_POSITION_VALUES },
  },
  defaultProps: {
    channel: 'whatsapp',
    value: '380501234567',
    label: 'Написать в WhatsApp',
    position: 'bottom-right',
  },
};

const CONTACTBUBBLEMULTI_SCHEMA: CuratedBlockSchema = {
  label: 'Плавающее меню связи',
  category: 'content',
  fields: {
    channels: {
      kind: 'list',
      maxItems: 5,
      itemFields: {
        type: { kind: 'enum', values: CONTACT_CHANNEL_VALUES },
        value: { kind: 'string', maxLength: 150 },
        label: { kind: 'string', maxLength: 60 },
      },
    },
    position: { kind: 'enum', values: CONTACT_POSITION_VALUES },
  },
  defaultProps: {
    channels: [
      { type: 'whatsapp', value: '380501234567', label: 'WhatsApp' },
      { type: 'phone', value: '380501234567', label: 'Позвонить' },
    ],
    position: 'bottom-right',
  },
};

const COUNTER_FIELDS: Record<string, CuratedField> = {
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  items: {
    kind: 'list',
    maxItems: 6,
    itemFields: {
      icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
      number: { kind: 'number', min: 0 },
      suffix: { kind: 'string', maxLength: 10 },
      label: { kind: 'string', maxLength: 100 },
    },
  },
};

const COUNTER_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: '',
  heading: 'Мы в цифрах',
  items: [
    { icon: 'check', number: 500, suffix: '+', label: 'довольных клиентов' },
    { icon: 'star', number: 10, suffix: '', label: 'лет на рынке' },
    { icon: 'heart', number: 98, suffix: '%', label: 'рекомендуют нас' },
  ],
};

const STATSCOUNTER_SCHEMA: CuratedBlockSchema = {
  label: 'Счётчики (анимация)',
  category: 'content',
  fields: COUNTER_FIELDS,
  defaultProps: COUNTER_DEFAULT_PROPS,
};

const STATSCOUNTERICONS_SCHEMA: CuratedBlockSchema = {
  label: 'Счётчики с иконками',
  category: 'content',
  fields: COUNTER_FIELDS,
  defaultProps: COUNTER_DEFAULT_PROPS,
};

const PORTFOLIO_FIELDS: Record<string, CuratedField> = {
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  description: { kind: 'string', maxLength: 400 },
  items: {
    kind: 'list',
    maxItems: 20,
    itemFields: {
      image: { kind: 'mediaAsset' },
      title: { kind: 'string', maxLength: 100 },
      category: { kind: 'string', maxLength: 60 },
      url: { kind: 'linkTarget' },
    },
  },
  columns: { kind: 'number', min: 2, max: 4 },
};

const PORTFOLIO_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: 'Портфолио',
  heading: 'Наши работы',
  description: '',
  items: [
    { image: null, title: 'Проект 1', category: 'Дизайн', url: EMPTY_LINK_TARGET },
    { image: null, title: 'Проект 2', category: 'Разработка', url: EMPTY_LINK_TARGET },
    { image: null, title: 'Проект 3', category: 'Брендинг', url: EMPTY_LINK_TARGET },
  ],
  columns: 3,
};

const PORTFOLIOGRID_SCHEMA: CuratedBlockSchema = {
  label: 'Портфолио (сетка)',
  category: 'content',
  fields: PORTFOLIO_FIELDS,
  defaultProps: PORTFOLIO_DEFAULT_PROPS,
};

const PORTFOLIOMASONRY_SCHEMA: CuratedBlockSchema = {
  label: 'Портфолио (плитка разной высоты)',
  category: 'content',
  fields: PORTFOLIO_FIELDS,
  defaultProps: PORTFOLIO_DEFAULT_PROPS,
};

const COOKIEBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Согласие на cookie',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 400 },
    acceptLabel: { kind: 'string', maxLength: 40 },
    declineLabel: { kind: 'string', maxLength: 40 },
  },
  defaultProps: {
    text: 'Мы используем файлы cookie, чтобы сайт работал лучше.',
    acceptLabel: 'Принять',
    declineLabel: 'Отклонить',
  },
};

const COOKIEBARMINIMAL_SCHEMA: CuratedBlockSchema = {
  label: 'Уведомление о cookie',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 400 },
    okLabel: { kind: 'string', maxLength: 40 },
  },
  defaultProps: {
    text: 'Мы используем файлы cookie для удобства работы сайта.',
    okLabel: 'Понятно',
  },
};

// Competitor-widget-library batch 4 — content/business.

const STEPS_ITEMS_FIELD = (): CuratedField => ({
  kind: 'list',
  maxItems: 6,
  itemFields: {
    icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
    title: { kind: 'string', maxLength: 100 },
    description: { kind: 'string', maxLength: 300 },
  },
});

const STEPS_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: 'Как это работает',
  heading: 'Три простых шага',
  items: [
    {
      icon: 'mail',
      title: 'Оставьте заявку',
      description: 'Заполните форму на сайте или напишите нам напрямую.',
    },
    {
      icon: 'clock',
      title: 'Согласуем детали',
      description: 'Свяжемся с вами в течение часа и уточним все нюансы.',
    },
    {
      icon: 'check',
      title: 'Получите результат',
      description: 'Выполним работу качественно и в оговорённый срок.',
    },
  ],
};

const STEPS_SCHEMA: CuratedBlockSchema = {
  label: 'Шаги (нумерация)',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: STEPS_ITEMS_FIELD(),
  },
  defaultProps: STEPS_DEFAULT_PROPS,
};

const STEPSICONS_SCHEMA: CuratedBlockSchema = {
  label: 'Шаги (иконки)',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    items: STEPS_ITEMS_FIELD(),
  },
  defaultProps: STEPS_DEFAULT_PROPS,
};

const ICONLIST_FIELDS = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  items: {
    kind: 'list',
    maxItems: 10,
    itemFields: {
      icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
      text: { kind: 'string', maxLength: 150 },
    },
  },
  columns: { kind: 'number', min: 1, max: 3 },
});

const ICONLIST_DEFAULT_PROPS: Record<string, unknown> = {
  eyebrow: '',
  heading: 'Что входит',
  items: [
    { icon: 'check', text: 'Бесплатная консультация' },
    { icon: 'check', text: 'Гарантия 12 месяцев' },
    { icon: 'check', text: 'Оплата после результата' },
  ],
  columns: 1,
};

const ICONLIST_SCHEMA: CuratedBlockSchema = {
  label: 'Список с иконками',
  category: 'content',
  fields: ICONLIST_FIELDS(),
  defaultProps: ICONLIST_DEFAULT_PROPS,
};

const ICONLISTINLINE_SCHEMA: CuratedBlockSchema = {
  label: 'Список с иконками (в строку)',
  category: 'content',
  fields: ICONLIST_FIELDS(),
  defaultProps: ICONLIST_DEFAULT_PROPS,
};

const ANNOUNCEMENTBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Полоса объявления',
  category: 'content',
  fields: {
    text: { kind: 'string', maxLength: 200 },
    linkLabel: { kind: 'string', maxLength: 60 },
    linkUrl: { kind: 'linkTarget' },
    dismissible: { kind: 'boolean' },
  },
  defaultProps: {
    text: 'Бесплатная доставка при заказе от 1000 ₴',
    linkLabel: 'Подробнее',
    linkUrl: EMPTY_LINK_TARGET,
    dismissible: true,
  },
};

const ANNOUNCEMENTBARMARQUEE_SCHEMA: CuratedBlockSchema = {
  label: 'Бегущая строка объявлений',
  category: 'content',
  fields: {
    items: {
      kind: 'list',
      maxItems: 8,
      itemFields: { text: { kind: 'string', maxLength: 150 } },
    },
  },
  defaultProps: {
    items: [
      { text: 'Бесплатная доставка от 1000 ₴' },
      { text: 'Новая коллекция уже в продаже' },
      { text: 'Скидка 10% по промокоду WELCOME' },
    ],
  },
};

// Competitor-widget-library batch 6 — content.

const SCARCITYBAR_SCHEMA: CuratedBlockSchema = {
  label: 'Полоса дефицита',
  category: 'content',
  fields: {
    label: { kind: 'string', maxLength: 100 },
    claimed: { kind: 'number', min: 0 },
    total: { kind: 'number', min: 1 },
  },
  defaultProps: {
    label: 'Осталось мало мест',
    claimed: 78,
    total: 100,
  },
};

const COUPONCODE_SCHEMA: CuratedBlockSchema = {
  label: 'Промокод',
  category: 'content',
  fields: {
    label: { kind: 'string', maxLength: 60 },
    code: { kind: 'string', maxLength: 40 },
    description: { kind: 'string', maxLength: 150 },
  },
  defaultProps: {
    label: 'Промокод',
    code: 'WELCOME10',
    description: 'Скидка 10% на первый заказ',
  },
};

const EVENTCOUNTDOWN_SCHEMA: CuratedBlockSchema = {
  label: 'Отсчёт до мероприятия',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    eventTitle: { kind: 'string', maxLength: 150 },
    targetDate: { kind: 'string', maxLength: 40 },
    durationMinutes: { kind: 'number', min: 5, max: 1440 },
    addToCalendarLabel: { kind: 'string', maxLength: 60 },
    expiredText: { kind: 'string', maxLength: 100 },
  },
  defaultProps: {
    eyebrow: 'Скоро',
    heading: 'Бесплатный вебинар',
    description: 'Присоединяйтесь к прямому эфиру — разберём главные вопросы.',
    eventTitle: 'Бесплатный вебинар',
    targetDate: '2026-12-31T18:00',
    durationMinutes: 60,
    addToCalendarLabel: 'Добавить в календарь',
    expiredText: 'Мероприятие уже прошло',
  },
};

const PROSCONS_SCHEMA: CuratedBlockSchema = {
  label: 'Плюсы и минусы',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    prosTitle: { kind: 'string', maxLength: 60 },
    consTitle: { kind: 'string', maxLength: 60 },
    pros: {
      kind: 'list',
      maxItems: 10,
      itemFields: { text: { kind: 'string', maxLength: 200 } },
    },
    cons: {
      kind: 'list',
      maxItems: 10,
      itemFields: { text: { kind: 'string', maxLength: 200 } },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Что важно знать',
    prosTitle: 'Плюсы',
    consTitle: 'Минусы',
    pros: [
      { text: 'Быстрый результат' },
      { text: 'Прозрачная цена' },
      { text: 'Поддержка на каждом шаге' },
    ],
    cons: [{ text: 'Нужна предоплата' }, { text: 'Ограниченное количество мест' }],
  },
};

const CALLOUT_VARIANT_VALUES = ['info', 'success', 'warning'] as const;

const CALLOUTBOX_SCHEMA: CuratedBlockSchema = {
  label: 'Заметка',
  category: 'content',
  fields: {
    icon: { kind: 'enum', values: ICON_CHOICE_VALUES },
    variant: { kind: 'enum', values: CALLOUT_VARIANT_VALUES },
    text: { kind: 'string', maxLength: 400 },
  },
  defaultProps: {
    icon: 'shield',
    variant: 'info',
    text: 'Важно: ознакомьтесь с условиями перед покупкой.',
  },
};

// Competitor-widget-library batch 8 — content.

const DATATABLE_SCHEMA: CuratedBlockSchema = {
  label: 'Таблица',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    headers: {
      kind: 'list',
      maxItems: 8,
      itemFields: { text: { kind: 'string', maxLength: 100 } },
    },
    rows: {
      kind: 'list',
      maxItems: 20,
      itemFields: {
        cells: {
          kind: 'list',
          maxItems: 8,
          itemFields: { text: { kind: 'string', maxLength: 200 } },
        },
      },
    },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Сравнение характеристик',
    headers: [{ text: 'Характеристика' }, { text: 'Базовый' }, { text: 'Премиум' }],
    rows: [
      { cells: [{ text: 'Поддержка' }, { text: 'Email' }, { text: '24/7' }] },
      { cells: [{ text: 'Хранилище' }, { text: '10 ГБ' }, { text: '100 ГБ' }] },
    ],
  },
};

const QUIZSINGLE_SCHEMA: CuratedBlockSchema = {
  label: 'Мини-тест',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    question: { kind: 'string', maxLength: 200 },
    choices: {
      kind: 'list',
      maxItems: 6,
      itemFields: {
        label: { kind: 'string', maxLength: 100 },
        resultText: { kind: 'string', maxLength: 400 },
      },
    },
    restartLabel: { kind: 'string', maxLength: 60 },
  },
  defaultProps: {
    eyebrow: 'Тест',
    question: 'Что вам важнее при выборе?',
    choices: [
      {
        label: 'Цена',
        resultText: 'Обратите внимание на наш базовый тариф — оптимален по цене.',
      },
      {
        label: 'Скорость',
        resultText: 'Рекомендуем тариф «Про» с приоритетной поддержкой.',
      },
      {
        label: 'Поддержка',
        resultText: 'Наш премиум-тариф включает поддержку 24/7.',
      },
    ],
    restartLabel: 'Пройти ещё раз',
  },
};

const STATSHERO_SCHEMA: CuratedBlockSchema = {
  label: 'Крупная цифра',
  category: 'content',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    number: { kind: 'number', min: 0 },
    suffix: { kind: 'string', maxLength: 10 },
    label: { kind: 'string', maxLength: 150 },
  },
  defaultProps: {
    eyebrow: '',
    number: 10000,
    suffix: '+',
    label: 'довольных клиентов по всему миру',
  },
};

// --- Commerce / Booking / Blog (data-driven, capability-gated) -----------

const DATA_SOURCE_GRID_FIELDS = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  description: { kind: 'string', maxLength: 400 },
  dataSource: { kind: 'dataSource' },
  columns: { kind: 'number', min: 2, max: 4 },
});

const PRODUCTGRID_SCHEMA: CuratedBlockSchema = {
  label: 'Каталог товаров',
  category: 'commerce',
  capability: 'commerce',
  fields: DATA_SOURCE_GRID_FIELDS(),
  defaultProps: {
    eyebrow: '',
    heading: 'Наши товары',
    description: '',
    dataSource: { limit: 6, sort: 'newest' },
    columns: 3,
  },
};

const SERVICEGRID_SCHEMA: CuratedBlockSchema = {
  label: 'Услуги (каталог)',
  category: 'booking',
  capability: 'booking',
  fields: DATA_SOURCE_GRID_FIELDS(),
  defaultProps: {
    eyebrow: '',
    heading: 'Наши услуги',
    description: '',
    dataSource: { limit: 6, sort: 'newest' },
    columns: 3,
  },
};

const BLOGGRID_SCHEMA: CuratedBlockSchema = {
  label: 'Блог',
  category: 'blog',
  capability: 'content',
  fields: DATA_SOURCE_GRID_FIELDS(),
  defaultProps: {
    eyebrow: '',
    heading: 'Новости и статьи',
    description: '',
    dataSource: { limit: 6, sort: 'newest' },
    columns: 3,
  },
};

// --- Forms -----------------------------------------------------------------

const FORM_FIELDS_SCHEMA = (): Record<string, CuratedField> => ({
  eyebrow: { kind: 'string', maxLength: 60 },
  heading: { kind: 'string', maxLength: 200 },
  description: { kind: 'string', maxLength: 400 },
  fields: {
    kind: 'list',
    maxItems: 6,
    itemFields: {
      label: { kind: 'string', maxLength: 100 },
      type: { kind: 'enum', values: ['text', 'email', 'textarea'] },
    },
  },
  submitLabel: { kind: 'string', maxLength: 60 },
  successMessage: { kind: 'string', maxLength: 300 },
});

const CONTACTFORM_SCHEMA: CuratedBlockSchema = {
  label: 'Форма обратной связи',
  category: 'forms',
  fields: FORM_FIELDS_SCHEMA(),
  defaultProps: {
    eyebrow: '',
    heading: 'Напишите нам',
    description: 'Ответим в течение рабочего дня.',
    fields: [
      { label: 'Имя', type: 'text' },
      { label: 'Email', type: 'email' },
      { label: 'Сообщение', type: 'textarea' },
    ],
    submitLabel: 'Отправить',
    successMessage: 'Спасибо! Мы получили ваше сообщение и скоро ответим.',
  },
};

const NEWSLETTERFORM_SCHEMA: CuratedBlockSchema = {
  label: 'Подписка на рассылку',
  category: 'forms',
  fields: FORM_FIELDS_SCHEMA(),
  defaultProps: {
    eyebrow: '',
    heading: 'Будьте в курсе новостей',
    description: '',
    fields: [{ label: 'Email', type: 'email' }],
    submitLabel: 'Подписаться',
    successMessage: 'Спасибо за подписку!',
  },
};

const SIMPLEFORM_SCHEMA: CuratedBlockSchema = {
  label: 'Произвольная форма',
  category: 'forms',
  fields: FORM_FIELDS_SCHEMA(),
  defaultProps: {
    eyebrow: '',
    heading: 'Оставьте заявку',
    description: '',
    fields: [{ label: 'Телефон', type: 'text' }],
    submitLabel: 'Отправить заявку',
    successMessage: 'Заявка отправлена, мы свяжемся с вами.',
  },
};

const NEWSLETTERPOPUP_SCHEMA: CuratedBlockSchema = {
  label: 'Всплывающая подписка',
  category: 'forms',
  fields: {
    ...FORM_FIELDS_SCHEMA(),
    delaySeconds: { kind: 'number', min: 0, max: 60 },
  },
  defaultProps: {
    eyebrow: '',
    heading: 'Не пропустите новости',
    description: 'Подпишитесь и получайте новости первыми.',
    fields: [{ label: 'Email', type: 'email' }],
    submitLabel: 'Подписаться',
    successMessage: 'Спасибо за подписку!',
    delaySeconds: 5,
  },
};

// --- Navigation --------------------------------------------------------

const FOOTER_SCHEMA: CuratedBlockSchema = {
  label: 'Подвал сайта',
  category: 'navigation',
  fields: {
    navLinks: NAV_LINKS_FIELD(6),
    copyrightText: { kind: 'string', maxLength: 200 },
  },
  defaultProps: {
    navLinks: [
      { label: 'О нас', url: { type: 'anchor', anchor: 'about' } },
      { label: 'Контакты', url: { type: 'anchor', anchor: 'contact' } },
    ],
    copyrightText: '',
  },
};

const BREADCRUMBS_SCHEMA: CuratedBlockSchema = {
  label: 'Хлебные крошки',
  category: 'navigation',
  fields: { items: NAV_LINKS_FIELD(DEFAULT_LIST_MAX_ITEMS) },
  defaultProps: {
    items: [
      { label: 'Главная', url: { type: 'page', pageId: '' } },
      { label: 'Текущая страница', url: { type: 'anchor', anchor: '' } },
    ],
  },
};

/** Живой поиск по данным бизнеса — Product/Service/BlogPost (уже публичные,
 * см. `PublicSitesController.getPublicProducts/Services/BlogPosts`) и/или
 * пользовательские Custom Entities, но ТОЛЬКО те, что владелец явно пометил
 * `isPublic: true` (`CustomEntitiesService.setVisibility`, отдельное owner-
 * only действие в дашборде — ни у одного AI-инструмента нет способа
 * включить публичность самому, см. её комментарий). Сам блок не хранит
 * результаты — только конфигурацию источников (`sources`, тот же принцип,
 * что у `control: 'dataSource'`, но здесь источников может быть НЕСКОЛЬКО
 * сразу, поэтому обычный `dataSource`-контрол, рассчитанный на один тип
 * данных, не подходит); поиск выполняется на клиенте по уже публично
 * доступным данным (см. `entities/website/blocks/navigation/index.tsx`).
 * `entityName` внутри источника имеет смысл только при `entity: 'custom'` —
 * то же имя сущности, что видно владельцу в разделе "База данных", не
 * внутренний id (см. `PublicCustomEntityDto`'s комментарий на backend). */
const ENTITYSEARCH_SCHEMA: CuratedBlockSchema = {
  label: 'Поиск по сайту',
  category: 'navigation',
  fields: {
    placeholder: { kind: 'string', maxLength: 60 },
    emptyText: { kind: 'string', maxLength: 100 },
    resultsLimit: { kind: 'number', min: 3, max: 20 },
    sources: {
      kind: 'list',
      maxItems: 4,
      itemFields: {
        entity: { kind: 'enum', values: ['product', 'service', 'post', 'custom'] },
        entityName: { kind: 'string', maxLength: 120 },
        label: { kind: 'string', maxLength: 60 },
      },
    },
  },
  defaultProps: {
    placeholder: 'Поиск…',
    emptyText: 'Ничего не найдено',
    resultsLimit: 6,
    sources: [{ entity: 'product', entityName: '', label: 'Товары' }],
  },
};

const ANCHORNAV_POSITION_VALUES = ['left', 'right'] as const;

const ANCHORNAV_SCHEMA: CuratedBlockSchema = {
  label: 'Навигация-точки',
  category: 'navigation',
  fields: {
    items: {
      kind: 'list',
      maxItems: 8,
      itemFields: {
        label: { kind: 'string', maxLength: 60 },
        url: { kind: 'linkTarget' },
      },
    },
    position: { kind: 'enum', values: ANCHORNAV_POSITION_VALUES },
  },
  defaultProps: {
    items: [
      { label: 'Главная', url: { type: 'anchor', anchor: 'top' } },
      { label: 'О нас', url: { type: 'anchor', anchor: 'about' } },
      { label: 'Услуги', url: { type: 'anchor', anchor: 'services' } },
      { label: 'Контакты', url: { type: 'anchor', anchor: 'contact' } },
    ],
    position: 'right',
  },
};

// --- Utility -------------------------------------------------------------

const EMBED_SCHEMA: CuratedBlockSchema = {
  label: 'Встраиваемый виджет',
  category: 'utility',
  fields: {
    embedUrl: { kind: 'string', maxLength: 2000 },
    height: { kind: 'number', min: 200, max: 1200 },
    caption: { kind: 'string', maxLength: 200 },
  },
  defaultProps: { embedUrl: '', height: 480, caption: '' },
};

const SCROLLPROGRESS_SCHEMA: CuratedBlockSchema = {
  label: 'Индикатор прокрутки',
  category: 'utility',
  fields: { color: { kind: 'enum', values: ['primary', 'text'] } },
  defaultProps: { color: 'primary' },
};

const BACKTOTOP_SCHEMA: CuratedBlockSchema = {
  label: 'Кнопка «Наверх»',
  category: 'utility',
  fields: { showAfterPx: { kind: 'number', min: 0, max: 5000 } },
  defaultProps: { showAfterPx: 400 },
};

const SCROLLCUE_SCHEMA: CuratedBlockSchema = {
  label: 'Подсказка «прокрутите вниз»',
  category: 'utility',
  fields: { url: { kind: 'linkTarget' } },
  defaultProps: { url: { type: 'anchor', anchor: 'about' } },
};

// --- Web3 ------------------------------------------------------------------

/** Первый блок с ЖИВЫМИ данными в этом allowlist: `props` — только
 * текстовая обвязка и `nftLimit`, сам баланс/NFT дозагружается на публичной
 * странице заново при каждом рендере — ему НЕ нужны `refs` вообще (нет ни
 * `mediaAsset`, ни `linkTarget` полей). */
const WEB3WALLET_SCHEMA: CuratedBlockSchema = {
  label: 'Кошелёк Web3',
  category: 'web3',
  fields: {
    eyebrow: { kind: 'string', maxLength: 60 },
    heading: { kind: 'string', maxLength: 200 },
    description: { kind: 'string', maxLength: 400 },
    nftLimit: { kind: 'number', min: 0, max: 24 },
  },
  defaultProps: { eyebrow: 'WEB3', heading: 'Наш кошелёк', description: '', nftLimit: 6 },
};

// --- Advertising -------------------------------------------------------

/** Единственное владелец-редактируемое поле — `placement` (см. корневой
 * план фичи §6): ни креатив, ни размеры/форматы здесь не настраиваются —
 * это и есть "Platform managed" (req. #7 исходной спецификации). Нет
 * `capability` — гейт НЕ через `Business.capabilities` (плановое решение,
 * см. `AdvertisingInventoryService`'s комментарий), а отдельная проверка в
 * `AddBlockTool`/`InsertCustomWidgetTool` перед созданием блока этого типа. */
const ADSLOT_SCHEMA: CuratedBlockSchema = {
  label: 'Рекламный слот',
  category: 'advertising',
  fields: {
    placement: {
      kind: 'enum',
      values: ['header', 'content', 'sidebar', 'footer', 'in_feed'],
    },
  },
  defaultProps: { placement: 'content' },
};

export const BLOCK_SCHEMAS: Record<AllowedBlockType, CuratedBlockSchema> = {
  section: SECTION_SCHEMA,
  container: CONTAINER_SCHEMA,
  columns: COLUMNS_SCHEMA,
  column: COLUMN_SCHEMA,
  spacer: SPACER_SCHEMA,
  divider: DIVIDER_SCHEMA,
  dividerlabel: DIVIDERLABEL_SCHEMA,
  dividericon: DIVIDERICON_SCHEMA,
  shapedivider: SHAPEDIVIDER_SCHEMA,
  heading: HEADING_SCHEMA,
  text: TEXT_SCHEMA,
  richtext: RICHTEXT_SCHEMA,
  quote: QUOTE_SCHEMA,
  image: IMAGE_SCHEMA,
  gallery: GALLERY_SCHEMA,
  video: VIDEO_SCHEMA,
  logo: LOGO_SCHEMA,
  imagecarousel: IMAGECAROUSEL_SCHEMA,
  imagecarouselthumbs: IMAGECAROUSELTHUMBS_SCHEMA,
  beforeafter: BEFOREAFTER_SCHEMA,
  beforeaftertabs: BEFOREAFTERTABS_SCHEMA,
  gallerylightbox: GALLERYLIGHTBOX_SCHEMA,
  gallerylightboxmasonry: GALLERYLIGHTBOXMASONRY_SCHEMA,
  imagehotspot: IMAGEHOTSPOT_SCHEMA,
  videogallery: VIDEOGALLERY_SCHEMA,
  audioembed: AUDIOEMBED_SCHEMA,
  imagecaption: IMAGECAPTION_SCHEMA,
  button: BUTTON_SCHEMA,
  buttongroup: BUTTONGROUP_SCHEMA,
  link: LINK_SCHEMA,
  cta: CTA_SCHEMA,
  businessheader: BUSINESSHEADER_SCHEMA,
  hero: HERO_SCHEMA,
  herosplitform: HEROSPLITFORM_SCHEMA,
  dualcta: DUALCTA_SCHEMA,
  about: ABOUT_SCHEMA,
  services: SERVICES_SCHEMA,
  servicecard: SERVICECARD_SCHEMA,
  pricing: PRICING_SCHEMA,
  pricingsingle: PRICINGSINGLE_SCHEMA,
  team: TEAM_SCHEMA,
  teammember: TEAMMEMBER_SCHEMA,
  teamsocial: TEAMSOCIAL_SCHEMA,
  testimonials: TESTIMONIALS_SCHEMA,
  reviews: REVIEWS_SCHEMA,
  testimonialwall: TESTIMONIALWALL_SCHEMA,
  ratingsummary: RATINGSUMMARY_SCHEMA,
  platformratings: PLATFORMRATINGS_SCHEMA,
  faq: FAQ_SCHEMA,
  faqtabs: FAQTABS_SCHEMA,
  accordionlist: ACCORDIONLIST_SCHEMA,
  faqsearch: FAQSEARCH_SCHEMA,
  contact: CONTACT_SCHEMA,
  openinghours: OPENINGHOURS_SCHEMA,
  businesshours: BUSINESSHOURS_SCHEMA,
  location: LOCATION_SCHEMA,
  locationslist: LOCATIONSLIST_SCHEMA,
  getdirections: GETDIRECTIONS_SCHEMA,
  sociallinks: SOCIALLINKS_SCHEMA,
  nativesharebutton: NATIVESHAREBUTTON_SCHEMA,
  socialshare: SOCIALSHARE_SCHEMA,
  testimonialsslider: TESTIMONIALSSLIDER_SCHEMA,
  teamslider: TEAMSLIDER_SCHEMA,
  videotestimonialslider: VIDEOTESTIMONIALSLIDER_SCHEMA,
  quotespotlight: QUOTESPOTLIGHT_SCHEMA,
  videotestimonial: VIDEOTESTIMONIAL_SCHEMA,
  herovideo: HEROVIDEO_SCHEMA,
  pricingtoggle: PRICINGTOGGLE_SCHEMA,
  pricingcalculator: PRICINGCALCULATOR_SCHEMA,
  socialproofbar: SOCIALPROOFBAR_SCHEMA,
  featuregrid: FEATUREGRID_SCHEMA,
  cards: CARDS_SCHEMA,
  articles: ARTICLES_SCHEMA,
  stats: STATS_SCHEMA,
  banner: BANNER_SCHEMA,
  timeline: TIMELINE_SCHEMA,
  timelinesimple: TIMELINESIMPLE_SCHEMA,
  timelinemedia: TIMELINEMEDIA_SCHEMA,
  tabs: TABS_SCHEMA,
  tabsvertical: TABSVERTICAL_SCHEMA,
  countdown: COUNTDOWN_SCHEMA,
  countdownbar: COUNTDOWNBAR_SCHEMA,
  logocloud: LOGOCLOUD_SCHEMA,
  logocloudmarquee: LOGOCLOUDMARQUEE_SCHEMA,
  comparison: COMPARISON_SCHEMA,
  comparisonsplit: COMPARISONSPLIT_SCHEMA,
  progressbars: PROGRESSBARS_SCHEMA,
  progresscircles: PROGRESSCIRCLES_SCHEMA,
  stickybar: STICKYBAR_SCHEMA,
  stickycountdownbar: STICKYCOUNTDOWNBAR_SCHEMA,
  popupoffer: POPUPOFFER_SCHEMA,
  exitintentpopup: EXITINTENTPOPUP_SCHEMA,
  contactbubble: CONTACTBUBBLE_SCHEMA,
  contactbubblemulti: CONTACTBUBBLEMULTI_SCHEMA,
  statscounter: STATSCOUNTER_SCHEMA,
  statscountericons: STATSCOUNTERICONS_SCHEMA,
  portfoliogrid: PORTFOLIOGRID_SCHEMA,
  portfoliomasonry: PORTFOLIOMASONRY_SCHEMA,
  cookiebar: COOKIEBAR_SCHEMA,
  cookiebarminimal: COOKIEBARMINIMAL_SCHEMA,
  steps: STEPS_SCHEMA,
  stepsicons: STEPSICONS_SCHEMA,
  iconlist: ICONLIST_SCHEMA,
  iconlistinline: ICONLISTINLINE_SCHEMA,
  announcementbar: ANNOUNCEMENTBAR_SCHEMA,
  announcementbarmarquee: ANNOUNCEMENTBARMARQUEE_SCHEMA,
  scarcitybar: SCARCITYBAR_SCHEMA,
  couponcode: COUPONCODE_SCHEMA,
  eventcountdown: EVENTCOUNTDOWN_SCHEMA,
  proscons: PROSCONS_SCHEMA,
  calloutbox: CALLOUTBOX_SCHEMA,
  datatable: DATATABLE_SCHEMA,
  quizsingle: QUIZSINGLE_SCHEMA,
  statshero: STATSHERO_SCHEMA,
  productgrid: PRODUCTGRID_SCHEMA,
  servicegrid: SERVICEGRID_SCHEMA,
  bloggrid: BLOGGRID_SCHEMA,
  contactform: CONTACTFORM_SCHEMA,
  newsletterform: NEWSLETTERFORM_SCHEMA,
  simpleform: SIMPLEFORM_SCHEMA,
  newsletterpopup: NEWSLETTERPOPUP_SCHEMA,
  footer: FOOTER_SCHEMA,
  breadcrumbs: BREADCRUMBS_SCHEMA,
  entitysearch: ENTITYSEARCH_SCHEMA,
  anchornav: ANCHORNAV_SCHEMA,
  embed: EMBED_SCHEMA,
  scrollprogress: SCROLLPROGRESS_SCHEMA,
  backtotop: BACKTOTOP_SCHEMA,
  scrollcue: SCROLLCUE_SCHEMA,
  web3wallet: WEB3WALLET_SCHEMA,
  adslot: ADSLOT_SCHEMA,
};

export const ALLOWED_BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as AllowedBlockType[];

export function isAllowedBlockType(value: string): value is AllowedBlockType {
  return (ALLOWED_BLOCK_TYPES as string[]).includes(value);
}

/** Есть ли хоть одно поле `linkTarget`/`mediaAsset` где угодно в схеме
 * (включая рекурсивно внутри `list.itemFields`) — производится ОДИН раз при
 * старте модуля на каждый тип через `needsBlockRefs` (`build-block-refs.ts`),
 * не на каждый вызов инструмента, так что лишний обход дерева схемы не
 * стоит отдельного кеша. */
function fieldsNeedRefs(fields: Record<string, CuratedField>): boolean {
  return Object.values(fields).some((field) => {
    if (field.kind === 'linkTarget' || field.kind === 'mediaAsset') return true;
    if (field.kind === 'list' && field.itemFields) return fieldsNeedRefs(field.itemFields);
    return false;
  });
}

export function schemaNeedsRefs(schema: CuratedBlockSchema): boolean {
  return fieldsNeedRefs(schema.fields);
}

/** Экспортирована — переиспользуется `custom-widgets/widget-fields.ts` для
 * валидации значений параметризованного виджета (`WidgetFieldSchema`, узкое
 * подмножество `CuratedField.kind`) той же самой, уже проверенной функцией,
 * а не копией её логики. */
export function validateOneField(
  key: string,
  field: CuratedField,
  value: unknown,
  refs: BuildValidatedPropsRefs,
): unknown {
  if (field.kind === 'enum') {
    if (typeof value !== 'string' || !field.values?.includes(value)) {
      throw new Error(`Поле "${key}" должно быть одним из: ${field.values?.join(', ')}`);
    }
    return value;
  }

  if (field.kind === 'linkTarget') {
    return validateLinkTarget(value, refs, key);
  }

  if (field.kind === 'mediaAsset') {
    if (value !== null && (typeof value !== 'string' || !refs.mediaAssetUrls.has(value))) {
      throw new Error(`Поле "${key}" должно быть null или ссылкой на уже загруженный файл`);
    }
    return value;
  }

  if (field.kind === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`Поле "${key}" должно быть true/false`);
    }
    return value;
  }

  if (field.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Поле "${key}" должно быть числом`);
    }
    if (field.min !== undefined && value < field.min) {
      throw new Error(`Поле "${key}" не может быть меньше ${field.min}`);
    }
    if (field.max !== undefined && value > field.max) {
      throw new Error(`Поле "${key}" не может быть больше ${field.max}`);
    }
    return value;
  }

  if (field.kind === 'dataSource') {
    if (typeof value !== 'object' || value === null) {
      throw new Error(`Поле "${key}" должно быть объектом {limit, sort}`);
    }
    const raw = value as Record<string, unknown>;
    const unknownKeys = Object.keys(raw).filter((k) => k !== 'limit' && k !== 'sort');
    if (unknownKeys.length > 0) {
      throw new Error(
        `Поле "${key}" допускает только limit/sort, лишние ключи: ${unknownKeys.join(', ')}`,
      );
    }
    if (
      typeof raw.limit !== 'number' ||
      !Number.isFinite(raw.limit) ||
      raw.limit < 1 ||
      raw.limit > 24
    ) {
      throw new Error(`Поле "${key}.limit" должно быть числом от 1 до 24`);
    }
    if (typeof raw.sort !== 'string' || !['newest', 'price-asc', 'price-desc'].includes(raw.sort)) {
      throw new Error(`Поле "${key}.sort" должно быть одним из: newest, price-asc, price-desc`);
    }
    return { limit: raw.limit, sort: raw.sort };
  }

  if (field.kind === 'list') {
    if (!Array.isArray(value)) {
      throw new Error(`Поле "${key}" должно быть массивом`);
    }
    const maxItems = field.maxItems ?? DEFAULT_LIST_MAX_ITEMS;
    if (value.length > maxItems) {
      throw new Error(`Поле "${key}" не может содержать больше ${maxItems} элементов`);
    }
    const itemFields = field.itemFields ?? {};
    return value.map((rawItem, index) => {
      if (typeof rawItem !== 'object' || rawItem === null) {
        throw new Error(`Элемент ${index} поля "${key}" должен быть объектом`);
      }
      const itemInput = rawItem as Record<string, unknown>;
      const unknownItemKeys = Object.keys(itemInput).filter((k) => !(k in itemFields));
      if (unknownItemKeys.length > 0) {
        throw new Error(
          `Неизвестные поля в элементе ${index} поля "${key}": ${unknownItemKeys.join(', ')}. Допустимые: ${Object.keys(itemFields).join(', ')}`,
        );
      }
      const item: Record<string, unknown> = {};
      for (const [itemKey, itemField] of Object.entries(itemFields)) {
        if (itemInput[itemKey] === undefined) continue;
        item[itemKey] = validateOneField(
          `${key}[${index}].${itemKey}`,
          itemField,
          itemInput[itemKey],
          refs,
        );
      }
      return item;
    });
  }

  // 'string' — дефолтная ветка.
  if (typeof value !== 'string') {
    throw new Error(`Поле "${key}" должно быть строкой`);
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    throw new Error(`Поле "${key}" не может быть длиннее ${field.maxLength} символов`);
  }
  return value;
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
  refs: BuildValidatedPropsRefs = EMPTY_REFS,
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
    result[key] = validateOneField(key, field, value, refs);
  }

  return result;
}
