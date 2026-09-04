import type { GoogleFontId } from './google-fonts';

/** Три брейкпоинта редактирования — тот же набор, что и у остального сайта
 * (`shared/styles/_mixins.scss`, `$bp-mobile`/`$bp-tablet`), но здесь это не
 * CSS-медиазапрос, а явный режим канваса билдера: пользователь переключает
 * его руками (см. `ViewportSwitcher`), а не он определяется реальной шириной
 * окна — сам канвас всегда меньше окна браузера. */
export type Viewport = 'desktop' | 'tablet' | 'mobile';

/** Реальная ширина (px) каждого вьюпорта редактирования — единственный
 * источник истины для канваса (`Canvas.tsx`) и предпросмотра
 * (`PreviewModal.tsx`), раньше продублированный в обоих местах со своими
 * (и одним багованным — `desktop: '100%'`, то есть «сколько есть у
 * текущего экрана», а не настоящая desktop-раскладка) значениями. Рамка
 * всегда рендерится этой физической шириной, а на экране уже, чем она,
 * вписывается через `useFitZoom` (`shared/lib/use-fit-zoom.ts`) — так
 * «Десктоп» на телефоне показывает уменьшенную, но пропорционально верную
 * десктопную раскладку, а не сплющенную мобильную. */
export const VIEWPORT_FRAME_WIDTH: Record<Viewport, number> = {
  desktop: 1280,
  tablet: 834,
  mobile: 390,
};

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

export type Background = 'none' | 'surface' | 'muted' | 'primary' | 'dark' | 'custom' | 'gradient';
export type TextAlign = 'left' | 'center' | 'right';
export type ContainerWidth = 'narrow' | 'default' | 'wide' | 'full';
export type SpacingSize = 'none' | 'sm' | 'md' | 'lg' | 'xl';

/** Как контейнерный блок (`section`/`container`/`columns`) раскладывает
 * своих детей — `'block'` (по умолчанию, старое поведение — вертикальный
 * стек через `gap`, без flex/grid вообще) сохраняет вид всех документов до
 * этого поля нетронутым, `'flex'`/`'grid'` включают `LayoutDirection`/
 * `LayoutJustify`/`LayoutAlign`/`gridColumns` ниже. */
export type LayoutDisplay = 'block' | 'flex' | 'grid';
export type LayoutDirection = 'row' | 'column';
export type LayoutJustify = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type LayoutAlign = 'start' | 'center' | 'end' | 'stretch';
/** Отступ — либо один из 5 именованных пресетов (`SpacingSize`), либо
 * произвольное число пикселей (`number`, напр. `18` → `18px`) — см.
 * `spacingToPx` в `block-style.ts`. Число — не отдельное поле-компаньон
 * вроде `customBackgroundColor`/`googleFontHeading`, а прямо значение в
 * том же слоте: `SpacingSize`/`number` уже различимы по `typeof`, так что
 * ни отдельный тумблер «свой», ни второе поле не нужны — тот же слот
 * `paddingY` и т. п. просто принимает более широкий тип. */
export type SpacingValue = SpacingSize | number;

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
  /** Только когда `background === 'gradient'` — градиент из двух hex-цветов
   * (`#rrggbb`). Как и `customBackgroundColor`, игнорируется рендерером при
   * любом другом значении `background`. Только двухцветный градиент в этом
   * инкременте — не 3+ цветов, узкий v1 из того, что просил бриф про
   * "background engine" (см. AI_PLATFORM_ROADMAP.md §27/§28). */
  gradientFrom?: string;
  gradientTo?: string;
  /** `undefined` — фолбэк `'linear'` (см. `backgroundValue` в
   * `block-style.ts`). `'radial'` игнорирует `gradientAngle` ниже — угол
   * осмысленен только для линейного направления, у круга его нет (см.
   * AI_PLATFORM_ROADMAP.md §28). */
  gradientType?: 'linear' | 'radial';
  /** Только для `gradientType: 'linear'` (или когда он не задан — линейный
   * по умолчанию) — угол в градусах (`0` — снизу вверх, `90` — слева
   * направо, CSS `linear-gradient()`-соглашение). `undefined` — фолбэк
   * `135` (диагональ сверху-слева вниз-направо). */
  gradientAngle?: number;
  /** Свой цвет текста этого блока (`#rrggbb`), независимый от темы сайта —
   * первое поле «кастомизации виджета», не только глобальных стилей темы
   * (AI_PLATFORM_ROADMAP.md §29.1/§30). Когда задан, побеждает над
   * автоматическим light/dark-переключением `contrastOverrides` для фона
   * ЭТОГО блока (`block-style.ts`) — осознанный выбор пользователя важнее
   * эвристики по яркости фона. Не трогает `--site-muted`/`--site-border` —
   * это только цвет основного текста, не полная цветовая тема блока. */
  textColor?: string;
  /** Рамка ВСЕГО блока (не путать с `ThemeCardBorder` — тот только для
   * карточных поверхностей ВНУТРИ блоков вроде `.icon-card`, этот — обводка
   * самого блока целиком, AI_PLATFORM_ROADMAP.md §31). `'none'`/не задано —
   * без рамки, остальные значения — толщина в px (см. `BORDER_WIDTH_PX` в
   * `theme-tokens.ts`). */
  borderWidth?: 'none' | 'thin' | 'medium' | 'thick';
  /** Только когда `borderWidth` не `'none'`/не задан. Пусто — берётся
   * `var(--site-border)` темы сайта (тот же приём "явный выбор побеждает,
   * иначе — из темы", что и у `textColor`). */
  borderColor?: string;
  /** Пресет тени всего блока — `'none'`/не задано значит без тени. Точные
   * X/Y/Blur/Spread здесь намеренно не поддерживаются в этом инкременте —
   * узкий v1 (см. AI_PLATFORM_ROADMAP.md §31). */
  shadow?: 'none' | 'soft' | 'medium' | 'strong' | 'floating';
  paddingY?: StyleValue<SpacingValue>;
  paddingX?: StyleValue<SpacingValue>;
  marginTop?: StyleValue<SpacingValue>;
  marginBottom?: StyleValue<SpacingValue>;
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
  paddingTop?: StyleValue<SpacingValue | null>;
  paddingRight?: StyleValue<SpacingValue | null>;
  paddingBottom?: StyleValue<SpacingValue | null>;
  paddingLeft?: StyleValue<SpacingValue | null>;

  // --- Раскладка (только контейнерные блоки — `section`/`container`/
  // `columns`, см. `definition.isContainer` в `registry.ts`) ---------------
  /** `undefined`/`'block'` — старое поведение (вертикальный стек через CSS-
   * класс блока, см. `layout.module.scss`), полностью без участия этих
   * полей — ни один существующий документ не меняется визуально, пока
   * автор явно не включит `'flex'`/`'grid'`. */
  display?: LayoutDisplay;
  /** Только при `display: 'flex'`. Responsive — самый частый «взрослый»
   * паттерн: ряд на десктопе, стопка на телефоне (сайдбар/шапка), без
   * ручного дублирования блока под каждый вьюпорт. */
  direction?: StyleValue<LayoutDirection>;
  /** Только при `display: 'flex'`. */
  wrap?: boolean;
  justify?: LayoutJustify;
  align?: LayoutAlign;
  /** Промежуток между детьми — та же шкала, что `paddingY` и т. п.
   * (`SpacingValue`, именованный пресет или свой px), применяется и к
   * `flex`, и к `grid`. */
  gap?: StyleValue<SpacingValue>;
  /** Только при `display: 'grid'` — число равных колонок (1–6); для
   * неравных пропорций (сайдбар) используйте `grow`/`fixedWidth` ниже на
   * ROW-раскладке (`display:'flex', direction:'row'`) вместо `grid`. */
  gridColumns?: StyleValue<number>;

  // --- Раскладка блока КАК РЕБЁНКА (актуально, только когда родитель сам
  // flex/grid — иначе браузер это игнорирует, поле безопасно как no-op на
  // любом блоке независимо от того, что у него за родитель) --------------
  /** `'fixed'` + `fixedWidth` — блок не сжимается/не растягивается
   * (`flex: 0 0 <fixedWidth>px`) — так делается сайдбар: одна колонка
   * `'fixed'`, соседняя (по умолчанию) `'grow'` (`flex: 1 1 0%`) забирает
   * всё оставшееся место. */
  grow?: 'grow' | 'fixed';
  /** Только при `grow: 'fixed'`. */
  fixedWidth?: number;

  // --- Позиция ------------------------------------------------------------
  /** `position: sticky` относительно ближайшего скролл-контейнера — вместе
   * с `grow:'fixed'` на ROW-раскладке даёт классический sticky-сайдбар.
   * `align-self: flex-start` подставляется автоматически, когда родитель —
   * flex (`computeBlockWrapperStyle`) — без него `stretch` по умолчанию
   * ломает sticky-расчёт высоты. */
  sticky?: boolean;
  /** Только при `sticky: true` — отступ от верха вьюпорта/скролл-контейнера
   * в px, по умолчанию `0`. */
  stickyOffset?: number;

  // --- Анимация появления при прокрутке ------------------------------------
  /** Однократный эффект появления, когда блок впервые попадает в зону
   * видимости при прокрутке (`entities/website/lib/use-scroll-reveal.ts`).
   * `undefined`/`'none'` — без анимации, рендерится как раньше. Общее поле
   * `BlockStyle`, не проп конкретного блока — работает для ЛЮБОГО типа
   * блока одинаково, т.к. подключено один раз в `BlockRenderer.tsx`, не в
   * каждом Renderer'е отдельно. Сознательно НЕ проигрывается в самом
   * канвасе билдера (`CanvasBlock.tsx`) — блок там перерисовывается на
   * каждое действие редактирования, повторяющийся fade/slide мешал бы, не
   * помогал; эффект виден в «Предпросмотр» и на самом сайте. */
  entranceAnimation?:
    'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in';
  /** Только при `entranceAnimation` ≠ `'none'`/`undefined` — задержка в мс
   * перед стартом анимации после появления в зоне видимости (не задержка
   * самого срабатывания обсёрвера). По умолчанию `0`. */
  entranceDelay?: number;
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

/** `'google'` — реальный веб-шрифт из курируемого списка (`GoogleFontId`,
 * `google-fonts.ts`), а не один из 5 системных стеков ниже: см.
 * `WebsiteTheme.fonts.googleFontHeading`/`googleFontBody` для того, КАКОЙ
 * именно шрифт из списка. */
export type FontChoice =
  'display-serif' | 'ui-sans' | 'mono' | 'rounded' | 'classic-serif' | 'google';
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
  fonts: {
    heading: FontChoice;
    body: FontChoice;
    /** Только когда соответствующий `heading`/`body` выше — `'google'`: какой
     * именно шрифт из курируемого списка (`GoogleFontId`, `google-fonts.ts`)
     * использовать. Игнорируется рендерером при любом другом `FontChoice` —
     * тот же приём, что и `BlockStyle.customBackgroundColor` при
     * `background !== 'custom'` (см. её комментарий). */
    googleFontHeading?: GoogleFontId;
    googleFontBody?: GoogleFontId;
  };
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
