import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@/shared/ui/icons';
import type {
  BlockStyle,
  ResponsiveValue,
  Viewport,
  WebsiteBlock,
  WebsitePage,
  WebsiteTheme,
} from './types';

export type BlockCategory =
  | 'layout'
  | 'typography'
  | 'media'
  | 'actions'
  | 'business'
  | 'navigation'
  | 'content'
  | 'commerce'
  | 'booking'
  | 'blog'
  | 'forms'
  | 'utility';

export const BLOCK_CATEGORY_LABELS: Record<BlockCategory, string> = {
  layout: 'Структура',
  typography: 'Текст',
  media: 'Медиа',
  actions: 'Кнопки',
  business: 'Бизнес',
  navigation: 'Навигация',
  content: 'Контент',
  commerce: 'Магазин',
  booking: 'Запись',
  blog: 'Блог',
  forms: 'Формы',
  utility: 'Утилиты',
};

/** Порядок панели компонентов слева в билдере (см. `ComponentLibraryPanel`)
 * — структура и текст первыми (с них обычно начинают верстать), утилиты
 * последними (их трогают реже всего). `commerce`/`booking`/`blog` — сразу
 * после `content`, рядом по смыслу (все четыре «витрина повторяющихся
 * карточек»), но после базовых категорий — они видны не всем (только с
 * включённой соответствующей капабилити, см. `ComponentLibraryPanel`'s
 * фильтр по `BlockDefinition.capability`). Отдельная категория `blog`, не
 * переиспользование существующей `content` — та уже занята универсальными
 * блоками (Карточки/Статьи/Баннер), доступными ВСЕМ независимо от капабилити;
 * смешивать их с гейтящимся `bloggrid` в одном разделе панели запутало бы,
 * какие блоки требуют включения, а какие нет. */
export const BLOCK_CATEGORY_ORDER: BlockCategory[] = [
  'layout',
  'typography',
  'media',
  'actions',
  'business',
  'content',
  'commerce',
  'booking',
  'blog',
  'navigation',
  'forms',
  'utility',
];

// --- Схема полей инспектора ------------------------------------------

interface FieldBase {
  /** Ключ в `block.props` (плоский, без точечных путей — форма каждого
   * блока сознательно плоская, см. `WebsiteBlock.props` в `types.ts`). */
  key: string;
  label: string;
  hint?: string;
  /** Значение в `props[key]` — не `T`, а `ResponsiveValue<T>`: инспектор
   * показывает/пишет значение текущего вьюпорта канваса (см. `Viewport` в
   * `BuilderState`), с каскадом при чтении (`resolveResponsive`). Отмечено
   * только там, где по смыслу реально нужно (см. `resolve-responsive.ts`,
   * комментарий про то, что не каждое поле — responsive). */
  responsive?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export type FieldSchema =
  | (FieldBase & { control: 'text'; placeholder?: string })
  | (FieldBase & { control: 'textarea'; placeholder?: string; rows?: number })
  | (FieldBase & { control: 'richtext' })
  | (FieldBase & { control: 'number'; min?: number; max?: number; step?: number; suffix?: string })
  | (FieldBase & { control: 'select'; options: SelectOption[] })
  | (FieldBase & { control: 'color' })
  | (FieldBase & { control: 'toggle' })
  | (FieldBase & { control: 'image' })
  | (FieldBase & { control: 'url' })
  /** Ссылка (переход по клику) — внешний адрес, страница ЭТОГО сайта, якорь
   * на текущей странице, телефон или почта, см. `LinkTarget` в `types.ts` и
   * `resolveLinkHref` в `resolve-link.ts`. Отдельный контрол от `url`: там
   * значение — голая строка «как есть» (для embed-адресов вроде видео/карты,
   * где ничего, кроме внешнего URL, никогда не имеет смысла), здесь —
   * структурная форма именно потому, что вариантов реально несколько.
   * `actionsEnabled` — показывать ли ещё и `addToCart`/`bookAppointment`
   * (см. `LinkTarget`'s комментарий) в дропдауне `LinkField.tsx`: только у
   * `button`/`buttongroup`/`cta` (`blocks/actions`), не у простого `link` —
   * та кнопка визуально и семантически про действие, обычная текстовая
   * ссылка — нет, ей нечем даже отрендерить эти два варианта (`LinkRenderer`
   * всегда рисует `<a href>`, а не `<button>`). */
  | (FieldBase & { control: 'link'; actionsEnabled?: boolean })
  /** Источник данных для data-driven виджетов (см. ROADMAP.md §3.4) —
   * `productgrid` никогда не хранит товары в своих `props`, только ПАРАМЕТРЫ
   * запроса (`limit`/`sort`, см. `DataSourceValue` в `types.ts`); сами
   * товары резолвятся заново при каждом рендере через `entities/product`
   * (см. `ProductGridRenderer` в `blocks/commerce`) — переименование/
   * изменение цены товара сразу видно везде, без пересохранения блока (тот
   * же принцип, что и у `LinkTarget`/`resolveLinkHref`: ссылка на данные,
   * не копия данных). `entity` — какую капабилити-сущность резолвить;
   * `'product'` (Commerce), `'service'` (Booking) и `'post'` (Content) —
   * единственные значения сегодня, растёт по мере появления новых
   * капабилити. */
  | (FieldBase & { control: 'dataSource'; entity: 'product' | 'service' | 'post' })
  | (FieldBase & { control: 'list'; itemLabel: string; itemFields: FieldSchema[]; max?: number });

/** Данные бизнеса, доступные любому блоку без ручного дублирования их в
 * свои `props` — блоки вроде `logo`/`businessheader`/`contact`/`footer`/
 * `sociallinks` подставляют название/лого/контакты бизнеса сами по себе,
 * пользователю не нужно заново вписывать email/телефон в каждый блок,
 * который их показывает (источник истины — карточка бизнеса, `/business/
 * [id]/settings`, см. `entities/business`). Блок всё равно может
 * переопределить что-то через собственные `props`, если задумано иначе. */
export interface BlockBusinessContext {
  /** Нужен только data-driven виджетам (`productgrid` и т. п., см.
   * `blocks/commerce`), которые сами дозагружают данные капабилити (товары,
   * позже — услуги/посты) по этому id — большинство блоков его не читают. */
  businessId: string;
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  socialLinks: { platform: string; url: string }[];
}

/** Пропсы, которые получает КАЖДЫЙ рендерер блока — и в билдере (canvas), и
 * на публичной странице/Preview: один и тот же компонент везде (см.
 * корневой план фичи, «Preview должен использовать тот же renderer»).
 * `children` — только для контейнерных блоков, рендерится вызывающим
 * `BlockRenderer`, не самим блоком (блок не должен знать, как рендерятся
 * его дети — это забота рекурсии, см. `ui/BlockRenderer.tsx`). */
export interface BlockRendererProps<P = Record<string, unknown>> {
  props: P;
  theme: WebsiteTheme;
  viewport: Viewport;
  business: BlockBusinessContext;
  children?: ReactNode;
  /** `true` внутри билдера — сам рендерер обычно это игнорирует (контент
   * должен выглядеть одинаково в билдере и на публичной странице), но
   * иногда полезно (например, форма не должна реально отправляться, пока
   * её редактируют). */
  isEditing?: boolean;
  /** Все страницы документа — нужны рендереру, только если у блока есть
   * поле `control: 'link'` со значением `{ type: 'page' }` (см. `LinkTarget`
   * в `types.ts`): `resolveLinkHref(props.buttonUrl, pages)` резолвит
   * `pageId` в реальный путь. Прокидывается всем рендерерам одинаково (см.
   * `BlockRenderer.tsx`/`CanvasBlock.tsx`), а не только тем, кому нужен —
   * так рендерер не должен ничего заранее знать о том, есть ли у него
   * ссылки, это решает его собственная схема полей. */
  pages: WebsitePage[];
}

export interface BlockDefinition<P = Record<string, unknown>> {
  type: string;
  label: string;
  category: BlockCategory;
  icon: ComponentType<IconProps>;
  description: string;
  defaultProps: P;
  /** Стартовые универсальные отступы/фон/ширина (см. `BlockStyle` в
   * `types.ts`) — например, `container` по умолчанию у́же `section`, хотя
   * оба редактируются одной и той же секцией инспектора. Не обязателен —
   * без него блок стартует вообще без своего `style` (наследует только то,
   * что даёт сама вёрстка). */
  defaultStyle?: BlockStyle;
  fields: FieldSchema[];
  Renderer: ComponentType<BlockRendererProps<P>>;
  /** Может содержать дочерние блоки (`section`/`columns`/`column`) — канвас
   * билдера показывает для них drop-зону между/внутри детей, а рендерер
   * получает `children` уже готовыми (см. `BlockRendererProps`). */
  isContainer?: boolean;
  /** Белый список типов дочерних блоков — только для контейнеров, где
   * произвольное содержимое реально ломает предположение о форме дерева
   * (сейчас единственный случай — `columns`: число реальных колонок
   * равно числу дочерних `column`, см. `blocks/layout/index.tsx`; обычный
   * блок, вставленный туда напрямую минуя `column`, сломал бы эту сетку).
   * Не задан (`undefined`) — контейнер принимает любой тип, как было до
   * появления этого поля (`section`/`container`/`column`). Проверяется в
   * `insertBlock`/`moveBlock` (`model/block-tree.ts`) — недопустимая
   * вставка/перемещение отклоняется целиком (дерево остаётся как было), а
   * не вставляется частично или ломает данные. */
  allowedChildren?: string[];
  /** Не показывается в библиотеке компонентов слева — заводится только как
   * ребёнок другого блока (сейчас — `column` внутри `columns`, см.
   * `blocks/layout/index.tsx`). Всё ещё полноценный тип реестра (выбирается,
   * настраивается, дублируется) — просто не то, что пользователь тащит с
   * нуля. */
  hidden?: boolean;
  /** Капабилити бизнеса (см. ROADMAP.md §3.3/§8 Phase 5, `Business.
   * capabilities` на backend), без которой блок не должен предлагаться к
   * добавлению — например, `productgrid` требует `'commerce'`. Не задано —
   * блок всегда доступен (все блоки, существовавшие до появления капабилити,
   * ведут себя так же, как раньше). Фильтруется ТОЛЬКО в `ComponentLibrary
   * Panel`/`AddBlockModal` (какие блоки МОЖНО добавить), не в `registry`/
   * `BlockRenderer` — уже размещённый блок обязан продолжать рендериться,
   * даже если капабилити потом выключили (тот же принцип «не ломай
   * существующий контент», что и у остальной части builder'а). */
  capability?: string;
}

// Реестр стирает конкретный тип `props` каждого блока (`unknown`, не
// `never`/сам généric `P`) — иначе достать блок по строковому `type` в
// одном месте для ЛЮБОГО зарегистрированного типа было бы невозможно
// типобезопасно в TS без такого стирания. Двойной каст через `unknown`
// (см. `registerBlock`/`getBlockDefinition`) — единственный способ
// сохранить строгую типизацию `P` на месте вызова `registerBlock<P>` и
// внутри самого рендерера/полей конкретного блока, при этом храня
// разнородные определения в одной коллекции.
const registry = new Map<string, BlockDefinition<unknown>>();

export function registerBlock<P>(definition: BlockDefinition<P>): void {
  if (registry.has(definition.type)) {
    throw new Error(`Тип блока "${definition.type}" уже зарегистрирован`);
  }
  registry.set(definition.type, definition as unknown as BlockDefinition<unknown>);
}

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return registry.get(type) as unknown as BlockDefinition | undefined;
}

export function listBlockDefinitions(): BlockDefinition[] {
  return [...registry.values()] as unknown as BlockDefinition[];
}

export function listVisibleBlockDefinitions(): BlockDefinition[] {
  return listBlockDefinitions().filter((definition) => !definition.hidden);
}

/** Фабрика нового блока данного типа с его дефолтными пропсами — один
 * источник правды вместо ручной сборки `{ id, type, props }` в каждом месте,
 * которое создаёт блок (drag из библиотеки, дублирование не отсюда — то
 * копирует существующий, см. `duplicateBlock` в `block-tree.ts`). */
export function createBlockInstance(type: string, id: string): WebsiteBlock {
  const definition = getBlockDefinition(type);
  if (!definition) throw new Error(`Неизвестный тип блока "${type}"`);
  return {
    id,
    type,
    props: { ...definition.defaultProps },
    style: definition.defaultStyle ? { ...definition.defaultStyle } : undefined,
    children: definition.isContainer ? [] : undefined,
  };
}

/** Чтение responsive-поля из `props` с каскадом — для полей, где
 * `field.responsive` (см. `FieldBase`). Значение в `props[key]` в этом
 * случае — не `T` сам по себе, а `ResponsiveValue<T>`; невалидная форма
 * (например, старый документ до того, как поле стало responsive) молча
 * трактуется как «то же значение на всех вьюпортах», а не падает. */
export function readResponsiveProp<T>(value: unknown, viewport: Viewport, fallback: T): T {
  if (value && typeof value === 'object' && 'desktop' in (value as object)) {
    const responsive = value as ResponsiveValue<T>;
    if (viewport === 'desktop') return responsive.desktop;
    if (viewport === 'tablet') return responsive.tablet ?? responsive.desktop;
    return responsive.mobile ?? responsive.tablet ?? responsive.desktop;
  }
  return (value as T) ?? fallback;
}

/** Обратная операция к `readResponsiveProp` — используется только
 * инспектором (`widgets/website-builder/ui/inspector/FieldControl.tsx`) при
 * записи значения responsive-поля текущего вьюпорта: превращает старое
 * значение `props[key]` (плоское или уже `ResponsiveValue`) в
 * `ResponsiveValue`, меняя только запись активного вьюпорта и не трогая
 * остальные — так правка на mobile не стирает override, ранее заданный на
 * tablet, и наоборот. */
export function writeResponsiveProp<T>(
  currentValue: unknown,
  viewport: Viewport,
  nextValue: T,
  fallback: T,
): ResponsiveValue<T> {
  const current: ResponsiveValue<T> =
    currentValue && typeof currentValue === 'object' && 'desktop' in (currentValue as object)
      ? (currentValue as ResponsiveValue<T>)
      : { desktop: (currentValue as T) ?? fallback };

  if (viewport === 'desktop') return { ...current, desktop: nextValue };
  if (viewport === 'tablet') return { ...current, tablet: nextValue };
  return { ...current, mobile: nextValue };
}
