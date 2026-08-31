/** Три брейкпоинта редактирования — тот же набор, что и у остального сайта
 * (`shared/styles/_mixins.scss`, `$bp-mobile`/`$bp-tablet`), но здесь это не
 * CSS-медиазапрос, а явный режим канваса билдера: пользователь переключает
 * его руками (см. `ViewportSwitcher`), а не он определяется реальной шириной
 * окна — сам канвас всегда меньше окна браузера. */
export type Viewport = 'desktop' | 'tablet' | 'mobile';

/**
 * Значение, которое может отличаться по вьюпортам — `desktop` обязателен
 * (это то, что видит публичный сайт по умолчанию и то, с чего блок
 * стартует), `tablet`/`mobile` — переопределения, отсутствие значит
 * «наследовать от более широкого» (см. `resolveResponsive` в
 * `resolve-responsive.ts`). Не каждое поле блока обёрнуто в этот тип —
 * только то немногое, что реально имеет смысл менять по экрану (размер
 * заголовка, число колонок, видимость), см. описание в корневом плане
 * фичи, раздел про Responsive.
 */
export interface ResponsiveValue<T> {
  desktop: T;
  tablet?: T;
  mobile?: T;
}

export type Background = 'none' | 'surface' | 'muted' | 'primary' | 'dark' | 'custom';
export type TextAlign = 'left' | 'center' | 'right';
export type ContainerWidth = 'narrow' | 'default' | 'wide' | 'full';
export type SpacingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl';

/** Значение поля `BlockStyle`, которое (как и `ResponsiveValue<T>` выше)
 * может отличаться по вьюпортам — плоское `T` для старых документов и
 * документов, где responsive-переопределение никогда не задавалось, читается
 * и пишется через тот же `readResponsiveProp`/`writeResponsiveProp`
 * (`registry.ts`), что уже используют responsive-поля `props` (см.
 * `FieldSchema.responsive`) — один и тот же механизм для обоих мест
 * хранения, без второй параллельной реализации каскада. */
export type StyleValue<T> = T | ResponsiveValue<T>;

/**
 * Настройки отступов/фона/выравнивания — общие для ЛЮБОГО блока, поэтому
 * живут отдельно от `props` (которые у каждого типа блока свои) и рисуются
 * в инспекторе одной и той же секцией «Отступы и фон» независимо от типа
 * выбранного блока (см. `widgets/website-builder/ui/inspector/
 * LayoutSection.tsx`). Так не приходится в 40 блоках по отдельности заново
 * объявлять одни и те же 5 полей в их `fields`.
 */
export interface BlockStyle {
  background?: Background;
  /** Только когда `background === 'custom'` — произвольный hex-цвет (`#rrggbb`)
   * фона блока, независимый от токенов темы (в отличие от `surface`/`muted`/
   * `primary`/`dark`, которые всегда читают `--site-*` переменные). Игнорируется
   * рендерером при любом другом значении `background` (см. `backgroundValue` в
   * `block-style.ts`) — не нужно чистить поле при переключении обратно на
   * пресет, оно просто перестаёт использоваться. */
  customBackgroundColor?: string;
  paddingY?: StyleValue<SpacingSize>;
  paddingX?: StyleValue<SpacingSize>;
  marginTop?: StyleValue<SpacingSize>;
  marginBottom?: StyleValue<SpacingSize>;
  textAlign?: TextAlign;
  /** Только для контейнерных блоков (`section`/`container`) — насколько
   * широко растягивается содержимое внутри полосы на всю ширину экрана. */
  maxWidth?: StyleValue<ContainerWidth>;
  /** Режим «Дополнительно» инспектора (`LayoutSection.tsx`) — независимые
   * отступы по каждой стороне вместо пары `paddingY`/`paddingX` выше.
   * `false`/отсутствует (все документы до этого инкремента) не меняет
   * рендер вообще — `paddingTop..Left` ниже полностью игнорируются, пара
   * работает ровно как раньше. */
  customPadding?: boolean;
  /** `null` (в т. ч. на конкретном вьюпорте внутри `ResponsiveValue`) значит
   * «наследовать от пары `paddingY`/`paddingX` на этом же вьюпорте», не
   * «обнулить» — для явного нуля уже есть `SpacingSize: 'none'`. `null`, а
   * не `undefined`: `ResponsiveValue` различает «объект переопределений» от
   * «плоское значение» по наличию ключа `desktop` (`readResponsiveProp`), а
   * `JSON.stringify` молча вырезает ключи со значением `undefined` — после
   * автосохранения `{ desktop: undefined, mobile: 'sm' }` превратился бы в
   * `{ mobile: 'sm' }` и обманул бы эту проверку. `null` то же самое место в
   * JSON переживает без потерь. */
  paddingTop?: StyleValue<SpacingSize | null>;
  paddingRight?: StyleValue<SpacingSize | null>;
  paddingBottom?: StyleValue<SpacingSize | null>;
  paddingLeft?: StyleValue<SpacingSize | null>;
}

/**
 * Один блок дерева сайта — сознательно плоская, декларативная форма
 * (`type` + `props`), без отдельного класса на каждый тип: ровно то, что
 * нужно, чтобы это можно было как рисовать в билдере, так и когда-нибудь
 * сгенерировать AI-промптом (см. корневой план фичи, раздел «AI-ready
 * architecture» — там ровно такой пример JSON). `props` типизирован слабо
 * здесь намеренно — форму конкретного типа знает только сам блок (см.
 * `registry.ts`, `BlockDefinition<P>`), а это общий тип дерева, который
 * должен принять любой существующий и будущий тип блока без правки.
 */
export interface WebsiteBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: BlockStyle;
  /** Отсутствие ключа для вьюпорта = виден. Так же, как остальные responsive-
   * поля, не завёрнуто в один общий `ResponsiveValue<boolean>` с обязательным
   * `desktop` — тут по смыслу «скрыт только там, где явно отметили», а не
   * «всегда должен быть explicit desktop-статус». */
  hidden?: Partial<Record<Viewport, boolean>>;
  /** Только контейнерные блоки реально её используют (см. `isContainer` в
   * `BlockDefinition`), но поле — на самом общем типе, а не в отдельном
   * подтипе: рекурсия рендера/дерева (`block-tree.ts`, `WebsiteRenderer`)
   * тогда работает без разбора типов на каждом уровне. */
  children?: WebsiteBlock[];
}

export interface WebsitePage {
  id: string;
  slug: string;
  title: string;
  blocks: WebsiteBlock[];
  /** Переопределение метаданных именно этой страницы (см. `generateMetadata`
   * в `app/site/[businessId]/[[...slug]]/page.tsx`) — `null`/`undefined`
   * значит «используй дефолт сайта» (`WebsiteDocument.settings.seoTitle`/
   * `seoDescription`), см. комментарий столбцов `WebsitePage.seoTitle`/
   * `seoDescription`/`ogImage` в backend schema.prisma. */
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImage?: string | null;
}

/**
 * Значение поля-ссылки (`FieldSchema` с `control: 'link'`) — структурная
 * форма вместо голой строки URL, специально ради варианта `page`: ссылка на
 * страницу хранит `pageId`, не готовый `/slug`, поэтому переименование или
 * реордер страниц (см. `WebsitePage`, `store.renamePage`/`movePage`) не
 * протухают ссылки на неё по всему сайту — `resolveLinkHref` разрешает
 * `pageId` в реальный путь заново при каждом рендере, а не один раз при
 * сохранении. Остальные варианты — то, чем раньше был обычный `control:
 * 'url'`/`'text'` (внешняя ссылка, якорь на той же странице, телефон,
 * почта), просто с явным типом вместо угадывания по содержимому строки.
 *
 * `addToCart`/`bookAppointment` (ROADMAP.md §3.4/§8 Phase 4, `actionsSchema`/
 * `useBlockAction()` line item) — не навигация вообще, поле по историческим
 * причинам называется "ссылка" (`control: 'link'`), но с этими двумя
 * вариантами это уже "что произойдёт по клику" в более широком смысле:
 * `SiteButton` (`blocks/actions/index.tsx`) рендерит для них `<button>` с
 * реальным действием (положить конкретный товар в корзину / открыть
 * `BookingModal` для конкретной услуги), не `<a href>`. Переименовывать сам
 * тип/поле не стали — потребовало бы правки во всех местах, которые уже
 * работают с `control: 'link'`/`LinkTarget` ради чистого именования, без
 * функциональной разницы. Это ровно те два действия из исходного союза
 * `navigate | openModal | submitForm | addToCart | bookAppointment | openUrl
 * | callPhone | sendEmail`, у которых не было готового backend'а на момент,
 * когда `actionsSchema` был впервые отложен (см. Phase 4 в §8) — остальные
 * уже покрыты существующими вариантами (`page`≈navigate, `external`≈openUrl,
 * `phone`≈callPhone, `email`≈sendEmail); `submitForm`/`openModal` остаются
 * не построены — `FormBlock` уже сам себе выполняет отправку без отдельной
 * кнопки-действия, а `openModal` не имеет обобщённого модального контента,
 * который стоило бы открывать (см. §8, тот же комментарий).
 */
export type LinkTarget =
  | { type: 'external'; url: string }
  | { type: 'page'; pageId: string }
  | { type: 'anchor'; anchor: string }
  | { type: 'phone'; phone: string }
  | { type: 'email'; email: string }
  | { type: 'addToCart'; productId: string }
  | { type: 'bookAppointment'; serviceId: string };

/** Значение поля `control: 'dataSource'` (см. `FieldSchema` в `registry.ts`)
 * — хранит только ПАРАМЕТРЫ запроса, никогда сами данные (см. её
 * комментарий). Без `filter` — фильтрация по категории/тегу осмысленна
 * только когда у сущности вообще есть категории (`Category`/`Collection` —
 * пока не построены, см. ROADMAP.md §2.2/§8 Phase 5: узкий v1 без них),
 * добавится тем же способом, что и остальные поля здесь, когда появится
 * реальная сущность-категория, а не раньше. */
export interface DataSourceValue {
  limit: number;
  sort: 'newest' | 'price-asc' | 'price-desc';
}

export type FontChoice = 'display-serif' | 'ui-sans' | 'mono' | 'rounded' | 'classic-serif';
export type ThemeRadius = 'none' | 'sm' | 'md' | 'lg' | 'full';
export type ButtonStyle = 'solid' | 'outline' | 'soft';
export type SectionSpacing = 'compact' | 'comfortable' | 'spacious';
/** Толщина рамки карточных поверхностей (`.icon-card`/`.people-card`/
 * `.simple-card` в `blocks/shared/primitives.module.scss`) — раньше `1px`
 * был захардкожен по отдельности в каждом из трёх мест (см. ROADMAP.md
 * §3.5/§8 Phase 11), теперь один токен темы. Только карточки, не форма/
 * кнопки/секции — те не задумывались как одна визуальная поверхность. */
export type ThemeCardBorder = 'none' | 'hairline' | 'bold';
/** Тень тех же карточных поверхностей — до этого инкремента `box-shadow` не
 * использовался нигде в блоках сайта вообще: явно новая, а не восстановленная
 * возможность (см. §8 Phase 11 — не путать с `ThemeCardBorder`, которая
 * действительно консолидирует уже существовавший захардкоженный `1px`). */
export type ThemeCardShadow = 'none' | 'sm' | 'md';

export interface WebsiteThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export interface WebsiteTheme {
  colors: WebsiteThemeColors;
  fonts: { heading: FontChoice; body: FontChoice };
  radius: ThemeRadius;
  buttonStyle: ButtonStyle;
  containerWidth: 'default' | 'wide';
  sectionSpacing: SectionSpacing;
  /** Опциональны, не как остальные поля темы — добавлены в Phase 11, уже
   * после того, как реальные сайты существовали без них (тот же приём, что
   * и у `WebsiteSettings.seoTitle`/`seoDescription` в Phase 10): `undefined`
   * у старого документа значит «используй фолбэк» (`hairline`/`none`, см.
   * `buildThemeCssVars` в `theme-tokens.ts`), а не невалидное состояние. */
  cardBorder?: ThemeCardBorder;
  cardShadow?: ThemeCardShadow;
}

export interface WebsiteSettings {
  seoTitle?: string;
  seoDescription?: string;
}

export interface WebsiteDocument {
  pages: WebsitePage[];
  theme: WebsiteTheme;
  settings: WebsiteSettings;
}
