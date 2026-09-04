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
  // actions
  | 'button'
  | 'buttongroup'
  | 'link'
  | 'cta'
  // business
  | 'businessheader'
  | 'hero'
  | 'about'
  | 'services'
  | 'servicecard'
  | 'pricing'
  | 'team'
  | 'teammember'
  | 'testimonials'
  | 'reviews'
  | 'faq'
  | 'contact'
  | 'openinghours'
  | 'location'
  | 'sociallinks'
  // content
  | 'featuregrid'
  | 'cards'
  | 'articles'
  | 'stats'
  | 'banner'
  // commerce / booking / blog (data-driven, capability-gated)
  | 'productgrid'
  | 'servicegrid'
  | 'bloggrid'
  // forms
  | 'contactform'
  | 'newsletterform'
  | 'simpleform'
  // navigation
  | 'footer'
  | 'breadcrumbs'
  // utility
  | 'embed'
  // web3
  | 'web3wallet';

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

interface CuratedField {
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

const SOCIALLINKS_SCHEMA: CuratedBlockSchema = {
  label: 'Соцсети',
  category: 'business',
  fields: {},
  defaultProps: {},
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

export const BLOCK_SCHEMAS: Record<AllowedBlockType, CuratedBlockSchema> = {
  section: SECTION_SCHEMA,
  container: CONTAINER_SCHEMA,
  columns: COLUMNS_SCHEMA,
  column: COLUMN_SCHEMA,
  spacer: SPACER_SCHEMA,
  divider: DIVIDER_SCHEMA,
  heading: HEADING_SCHEMA,
  text: TEXT_SCHEMA,
  richtext: RICHTEXT_SCHEMA,
  quote: QUOTE_SCHEMA,
  image: IMAGE_SCHEMA,
  gallery: GALLERY_SCHEMA,
  video: VIDEO_SCHEMA,
  logo: LOGO_SCHEMA,
  button: BUTTON_SCHEMA,
  buttongroup: BUTTONGROUP_SCHEMA,
  link: LINK_SCHEMA,
  cta: CTA_SCHEMA,
  businessheader: BUSINESSHEADER_SCHEMA,
  hero: HERO_SCHEMA,
  about: ABOUT_SCHEMA,
  services: SERVICES_SCHEMA,
  servicecard: SERVICECARD_SCHEMA,
  pricing: PRICING_SCHEMA,
  team: TEAM_SCHEMA,
  teammember: TEAMMEMBER_SCHEMA,
  testimonials: TESTIMONIALS_SCHEMA,
  reviews: REVIEWS_SCHEMA,
  faq: FAQ_SCHEMA,
  contact: CONTACT_SCHEMA,
  openinghours: OPENINGHOURS_SCHEMA,
  location: LOCATION_SCHEMA,
  sociallinks: SOCIALLINKS_SCHEMA,
  featuregrid: FEATUREGRID_SCHEMA,
  cards: CARDS_SCHEMA,
  articles: ARTICLES_SCHEMA,
  stats: STATS_SCHEMA,
  banner: BANNER_SCHEMA,
  productgrid: PRODUCTGRID_SCHEMA,
  servicegrid: SERVICEGRID_SCHEMA,
  bloggrid: BLOGGRID_SCHEMA,
  contactform: CONTACTFORM_SCHEMA,
  newsletterform: NEWSLETTERFORM_SCHEMA,
  simpleform: SIMPLEFORM_SCHEMA,
  footer: FOOTER_SCHEMA,
  breadcrumbs: BREADCRUMBS_SCHEMA,
  embed: EMBED_SCHEMA,
  web3wallet: WEB3WALLET_SCHEMA,
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

function validateOneField(
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
