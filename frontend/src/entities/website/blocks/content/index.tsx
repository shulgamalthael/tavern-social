'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  CloseIcon,
  ClockIcon,
  ColumnsIcon,
  CopyIcon,
  ExternalLinkIcon,
  ForwardIcon,
  GlobeIcon,
  GridIcon,
  ImageIcon,
  MailIcon,
  MegaphoneIcon,
  MessagesIcon,
  MobileIcon,
  PlusIcon,
  RowsIcon,
  ShieldIcon,
  SparkleIcon,
  TagIcon,
} from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';
import {
  formatCountdownCompact,
  getCountdownParts,
  type CountdownParts,
} from '../../lib/countdown';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { EMPTY_LINK_TARGET, resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget, WebsitePage } from '../../model/types';
import { EditableText } from '../../ui/EditableText';
import { RepeatableIconCards } from '../shared/RepeatableIconCards';
import { RepeatableSimpleCards } from '../shared/RepeatableSimpleCards';
import { ICON_CHOICE_OPTIONS, resolveIconChoice } from '../shared/icon-choices';
import { patchListItem } from '../shared/patch-list-item';
import { SectionHeading } from '../shared/SectionHeading';
import styles from './content.module.scss';

// --- Feature grid ------------------------------------------------------
// Тот же движок, что у `services` (см. `blocks/business/index.tsx`) — не
// про конкретный бизнес-домен, а общее «преимущество/особенность + иконка»,
// поэтому здесь, в Content, не в Business.

interface FeatureGridProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: { icon: string; title: string; description: string }[];
  columns: number;
}

function FeatureGridRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<FeatureGridProps>) {
  return (
    <RepeatableIconCards
      {...props}
      editable={Boolean(isEditing && onEditProp)}
      onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
      onEditHeading={(value) => onEditProp?.('heading', value)}
      onEditDescription={(value) => onEditProp?.('description', value)}
      onEditItem={(index, field, value) =>
        onEditProp?.('items', patchListItem(props.items, index, field, value))
      }
    />
  );
}

registerBlock<FeatureGridProps>({
  type: 'featuregrid',
  label: 'Преимущества',
  category: 'content',
  icon: GridIcon,
  description: 'Сетка «иконка + заголовок + текст»',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    {
      key: 'items',
      label: 'Преимущества',
      control: 'list',
      itemLabel: 'Преимущество',
      itemFields: [
        { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
        { key: 'title', label: 'Заголовок', control: 'text' },
        { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
      ],
    },
    { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
  ],
  Renderer: FeatureGridRenderer,
});

// --- Steps ---------------------------------------------------------------
// Один движок для двух типов (`steps`/`stepsicons`) — тот же приём, что у
// `tabs`/`tabsvertical` ниже: общий рендер-компонент с булевым параметром,
// два отдельных `registerBlock` с одними дефолтами/полями. `icon` в данных
// используется только `stepsicons` — у `steps` он просто игнорируется
// (не отдельная форма данных ради одного булева переключателя отображения).

interface StepItem {
  icon: string;
  title: string;
  description: string;
}

interface StepsProps {
  eyebrow: string;
  heading: string;
  items: StepItem[];
}

function StepsBlock({
  props,
  iconMode,
  isEditing,
  onEditProp,
}: {
  props: StepsProps;
  iconMode: boolean;
  isEditing?: boolean;
  onEditProp?: (key: string, value: unknown) => void;
}) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles.steps}>
        {props.items.map((item, index) => {
          const Icon = resolveIconChoice(item.icon);
          return (
            <div key={index} className={styles['steps__item']}>
              <span className={styles['steps__marker']}>{iconMode ? <Icon /> : index + 1}</span>
              <span className={styles['steps__title']}>{item.title}</span>
              {item.description && (
                <p className={styles['steps__description']}>{item.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<StepsProps>) {
  return (
    <StepsBlock props={props} iconMode={false} isEditing={isEditing} onEditProp={onEditProp} />
  );
}

function StepsIconsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<StepsProps>) {
  return <StepsBlock props={props} iconMode isEditing={isEditing} onEditProp={onEditProp} />;
}

const stepsDefaultProps: StepsProps = {
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

const stepsFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  {
    key: 'items',
    label: 'Шаги',
    control: 'list',
    itemLabel: 'Шаг',
    max: 6,
    itemFields: [
      {
        key: 'icon',
        label: 'Иконка (для варианта с иконками)',
        control: 'select',
        options: ICON_CHOICE_OPTIONS,
      },
      { key: 'title', label: 'Заголовок', control: 'text' },
      { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
    ],
  },
];

registerBlock<StepsProps>({
  type: 'steps',
  label: 'Шаги (нумерация)',
  category: 'content',
  icon: ForwardIcon,
  description: 'Пронумерованные шаги процесса, соединённые линией',
  defaultProps: stepsDefaultProps,
  fields: stepsFields,
  Renderer: StepsRenderer,
});

registerBlock<StepsProps>({
  type: 'stepsicons',
  label: 'Шаги (иконки)',
  category: 'content',
  icon: SparkleIcon,
  description: 'Шаги процесса с иконками вместо номеров',
  defaultProps: stepsDefaultProps,
  fields: stepsFields,
  Renderer: StepsIconsRenderer,
});

// --- Icon list -------------------------------------------------------------
// Тот же приём: один движок, параметр `inline` переключает вертикальный
// чек-лист (полноценная секция с заголовком) на горизонтальный ряд коротких
// значков-бейджей (обычно под кнопкой хиро — «бесплатная доставка», «оплата
// после результата» и т. п.). Отличается от `featuregrid` намеренно: там
// карточки с тенью/рамкой, здесь — плоский список без карточной обвязки.

interface IconListItem {
  icon: string;
  text: string;
}

interface IconListProps {
  eyebrow: string;
  heading: string;
  items: IconListItem[];
  columns: number;
}

function IconListBlock({
  props,
  inline,
  isEditing,
  onEditProp,
}: {
  props: IconListProps;
  inline: boolean;
  isEditing?: boolean;
  onEditProp?: (key: string, value: unknown) => void;
}) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div
        className={cn(styles['icon-list'], inline && styles['icon-list--inline'])}
        style={!inline ? ({ '--icon-list-columns': props.columns } as CSSProperties) : undefined}
      >
        {props.items.map((item, index) => {
          const Icon = resolveIconChoice(item.icon);
          return (
            <span key={index} className={styles['icon-list__item']}>
              <Icon className={styles['icon-list__icon']} />
              {item.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function IconListRenderer({ props, isEditing, onEditProp }: BlockRendererProps<IconListProps>) {
  return (
    <IconListBlock props={props} inline={false} isEditing={isEditing} onEditProp={onEditProp} />
  );
}

function IconListInlineRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<IconListProps>) {
  return <IconListBlock props={props} inline isEditing={isEditing} onEditProp={onEditProp} />;
}

const iconListDefaultProps: IconListProps = {
  eyebrow: '',
  heading: 'Что входит',
  items: [
    { icon: 'check', text: 'Бесплатная консультация' },
    { icon: 'check', text: 'Гарантия 12 месяцев' },
    { icon: 'check', text: 'Оплата после результата' },
  ],
  columns: 1,
};

const iconListFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  {
    key: 'items',
    label: 'Пункты',
    control: 'list',
    itemLabel: 'Пункт',
    max: 10,
    itemFields: [
      { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
      { key: 'text', label: 'Текст', control: 'text' },
    ],
  },
  { key: 'columns', label: 'Колонок', control: 'number', min: 1, max: 3 },
];

registerBlock<IconListProps>({
  type: 'iconlist',
  label: 'Список с иконками',
  category: 'content',
  icon: RowsIcon,
  description: 'Вертикальный чек-лист с иконками',
  defaultProps: iconListDefaultProps,
  fields: iconListFields,
  Renderer: IconListRenderer,
});

registerBlock<IconListProps>({
  type: 'iconlistinline',
  label: 'Список с иконками (в строку)',
  category: 'content',
  icon: ColumnsIcon,
  description: 'Короткие пункты в строку — значки под кнопкой хиро или заголовком',
  defaultProps: iconListDefaultProps,
  fields: iconListFields.filter((field) => field.key !== 'columns'),
  Renderer: IconListInlineRenderer,
});

// --- Announcement bar --------------------------------------------------
// В потоке страницы, НЕ `position: fixed` — сознательно иначе, чем
// `stickybar`/`popupoffer` ниже: та полоса «приклеена» специально (успевает
// поймать взгляд перед уходом), эта — обычно первый блок страницы, задача
// не «прилипнуть», а просто быть видной сразу при загрузке. `fixed` вдобавок
// к уже существующим `stickybar`/`popupoffer` без общей системы координации
// увеличивал бы риск наложения виджетов друг на друга (см. §53 в
// AI_PLATFORM_ROADMAP.md, «named, not fixed») — обычный поток снимает эту
// проблему для этого блока полностью, не решая её в общем виде.

const ANNOUNCEMENT_BAR_STORAGE_KEY = 'tavern-site-announcementbar-dismissed';

interface AnnouncementBarProps {
  text: string;
  linkLabel: string;
  linkUrl: LinkTarget;
  dismissible: boolean;
}

function AnnouncementBarRenderer({
  props,
  pages,
  isEditing,
}: BlockRendererProps<AnnouncementBarProps>) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isEditing || !props.dismissible) return;
    queueMicrotask(() => {
      try {
        if (window.sessionStorage.getItem(ANNOUNCEMENT_BAR_STORAGE_KEY) === '1') {
          setDismissed(true);
        }
      } catch {
        // Приватный режим/запрещённое хранилище — просто не запоминаем, см.
        // тот же приём у `StickyBarRenderer` ниже.
      }
    });
  }, [isEditing, props.dismissible]);

  if (dismissed && !isEditing) return null;

  function handleDismiss() {
    setDismissed(true);
    if (!props.dismissible) return;
    try {
      window.sessionStorage.setItem(ANNOUNCEMENT_BAR_STORAGE_KEY, '1');
    } catch {
      // См. комментарий выше.
    }
  }

  return (
    <div className={styles['announcement-bar']}>
      <span className={styles['announcement-bar__text']}>
        {props.text}
        {props.linkLabel && (
          <a
            href={resolveLinkHref(props.linkUrl, pages)}
            className={styles['announcement-bar__link']}
          >
            {props.linkLabel}
          </a>
        )}
      </span>
      {props.dismissible && (
        <button
          type="button"
          className={styles['announcement-bar__close']}
          aria-label="Закрыть объявление"
          onClick={handleDismiss}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

registerBlock<AnnouncementBarProps>({
  type: 'announcementbar',
  label: 'Полоса объявления',
  category: 'content',
  icon: TagIcon,
  description: 'Тонкая полоса объявления вверху страницы, можно закрыть',
  defaultProps: {
    text: 'Бесплатная доставка при заказе от 1000 ₴',
    linkLabel: 'Подробнее',
    linkUrl: EMPTY_LINK_TARGET,
    dismissible: true,
  },
  fields: [
    { key: 'text', label: 'Текст', control: 'text' },
    { key: 'linkLabel', label: 'Текст ссылки (необязательно)', control: 'text' },
    { key: 'linkUrl', label: 'Ссылка', control: 'link' },
    { key: 'dismissible', label: 'Можно закрыть', control: 'toggle' },
  ],
  Renderer: AnnouncementBarRenderer,
});

interface MarqueeMessage {
  text: string;
}

interface AnnouncementBarMarqueeProps {
  items: MarqueeMessage[];
}

function AnnouncementBarMarqueeRenderer({
  props,
}: BlockRendererProps<AnnouncementBarMarqueeProps>) {
  if (props.items.length === 0) return null;

  return (
    <div className={styles['announcement-marquee']}>
      <div className={styles['announcement-marquee__track']}>
        <div className={styles['announcement-marquee__set']}>
          {props.items.map((item, index) => (
            <span key={index} className={styles['announcement-marquee__item']}>
              {item.text}
              <span className={styles['announcement-marquee__dot']} aria-hidden="true">
                •
              </span>
            </span>
          ))}
        </div>
        <div className={styles['announcement-marquee__set']} aria-hidden="true">
          {props.items.map((item, index) => (
            <span key={index} className={styles['announcement-marquee__item']}>
              {item.text}
              <span className={styles['announcement-marquee__dot']} aria-hidden="true">
                •
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

registerBlock<AnnouncementBarMarqueeProps>({
  type: 'announcementbarmarquee',
  label: 'Бегущая строка объявлений',
  category: 'content',
  icon: MegaphoneIcon,
  description: 'Полоса с непрерывно бегущим текстом — акции, новости, объявления',
  defaultProps: {
    items: [
      { text: 'Бесплатная доставка от 1000 ₴' },
      { text: 'Новая коллекция уже в продаже' },
      { text: 'Скидка 10% по промокоду WELCOME' },
    ],
  },
  fields: [
    {
      key: 'items',
      label: 'Сообщения',
      control: 'list',
      itemLabel: 'Сообщение',
      max: 8,
      itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
    },
  ],
  Renderer: AnnouncementBarMarqueeRenderer,
});

// --- Cards / Articles ------------------------------------------------------
// Тот же движок `RepeatableSimpleCards` для обоих — различаются дефолтами
// (у статей есть дата, у обычных карточек её обычно нет), см. `blocks/
// shared/RepeatableSimpleCards.tsx`.

interface SimpleCardsProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: {
    image: string | null;
    title: string;
    description: string;
    meta: string;
    url: LinkTarget;
  }[];
  columns: number;
}

const simpleCardsFields = (metaLabel: string): FieldSchema[] => [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'items',
    label: 'Карточки',
    control: 'list',
    itemLabel: 'Карточка',
    itemFields: [
      { key: 'image', label: 'Изображение', control: 'image' },
      { key: 'title', label: 'Заголовок', control: 'text' },
      { key: 'description', label: 'Текст', control: 'textarea', rows: 2 },
      { key: 'meta', label: metaLabel, control: 'text' },
      { key: 'url', label: 'Ссылка', control: 'link' },
    ],
  },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

function CardsRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<SimpleCardsProps>) {
  return (
    <RepeatableSimpleCards
      {...props}
      pages={pages}
      editable={Boolean(isEditing && onEditProp)}
      onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
      onEditHeading={(value) => onEditProp?.('heading', value)}
      onEditDescription={(value) => onEditProp?.('description', value)}
      onEditItem={(index, field, value) =>
        onEditProp?.('items', patchListItem(props.items, index, field, value))
      }
    />
  );
}

registerBlock<SimpleCardsProps>({
  type: 'cards',
  label: 'Карточки',
  category: 'content',
  icon: GridIcon,
  description: 'Универсальная сетка карточек с картинкой',
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
  fields: simpleCardsFields('Метка (необязательно)'),
  Renderer: CardsRenderer,
});

function ArticlesRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<SimpleCardsProps>) {
  return (
    <RepeatableSimpleCards
      {...props}
      pages={pages}
      editable={Boolean(isEditing && onEditProp)}
      onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
      onEditHeading={(value) => onEditProp?.('heading', value)}
      onEditDescription={(value) => onEditProp?.('description', value)}
      onEditItem={(index, field, value) =>
        onEditProp?.('items', patchListItem(props.items, index, field, value))
      }
    />
  );
}

registerBlock<SimpleCardsProps>({
  type: 'articles',
  label: 'Статьи и новости',
  category: 'content',
  icon: GridIcon,
  description: 'Превью статей или новостей с датой',
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
  fields: simpleCardsFields('Дата'),
  Renderer: ArticlesRenderer,
});

// --- Stats -----------------------------------------------------------------

interface StatItem {
  number: string;
  label: string;
}

interface StatsProps {
  eyebrow: string;
  heading: string;
  items: StatItem[];
}

function StatsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<StatsProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles.stats}>
        {props.items.map((item, index) => (
          <div key={index} className={styles['stats__item']}>
            <span className={styles['stats__number']}>{item.number}</span>
            <span className={styles['stats__label']}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<StatsProps>({
  type: 'stats',
  label: 'Цифры и факты',
  category: 'content',
  icon: ChartIcon,
  description: 'Крупные цифры с подписью',
  defaultProps: {
    eyebrow: '',
    heading: '',
    items: [
      { number: '10+', label: 'лет на рынке' },
      { number: '500+', label: 'довольных клиентов' },
      { number: '24/7', label: 'поддержка' },
    ],
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Показатели',
      control: 'list',
      itemLabel: 'Показатель',
      max: 5,
      itemFields: [
        { key: 'number', label: 'Число', control: 'text' },
        { key: 'label', label: 'Подпись', control: 'text' },
      ],
    },
  ],
  Renderer: StatsRenderer,
});

// --- Banner ------------------------------------------------------------
// Объединяет «Announcement» и «Banner» из ТЗ — по сути один и тот же
// элемент (короткое сообщение поперёк страницы), см. корневой план фичи,
// раздел про упрощения MVP.

interface BannerProps {
  text: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

function BannerRenderer({ props, pages, isEditing, onEditProp }: BlockRendererProps<BannerProps>) {
  return (
    <div className={styles.banner}>
      <MegaphoneIcon className={styles['banner__icon']} />
      <EditableText
        as="span"
        value={props.text}
        editable={Boolean(isEditing && onEditProp)}
        onCommit={(value) => onEditProp?.('text', value)}
        placeholder="Текст объявления"
        className={styles['banner__text']}
      />
      {props.buttonLabel && (
        <a href={resolveLinkHref(props.buttonUrl, pages)} className={styles['banner__link']}>
          {props.buttonLabel}
        </a>
      )}
    </div>
  );
}

registerBlock<BannerProps>({
  type: 'banner',
  label: 'Объявление',
  category: 'content',
  icon: MegaphoneIcon,
  description: 'Короткая заметная полоса-объявление',
  defaultProps: {
    text: 'Скидка 20% до конца месяца',
    buttonLabel: 'Подробнее',
    buttonUrl: EMPTY_LINK_TARGET,
  },
  defaultStyle: { background: 'primary', paddingY: 'sm' },
  fields: [
    { key: 'text', label: 'Текст', control: 'text' },
    { key: 'buttonLabel', label: 'Текст ссылки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка', control: 'link' },
  ],
  Renderer: BannerRenderer,
});

// --- Timeline ----------------------------------------------------------
// Два самостоятельных типа с одинаковой формой `props`, различаются только
// раскладкой (шахматная лента вокруг центральной линии vs один левый рельс)
// — тот же приём, что у `team`/`teammember`/`testimonials`
// (`blocks/business/index.tsx`): общий движок, отдельный `type` на каждый
// визуальный вариант, а не пользовательский переключатель варианта внутри
// одного типа (см. комментарий у `RepeatablePeopleCards`).

interface TimelineItem {
  date: string;
  title: string;
  description: string;
}

interface TimelineProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: TimelineItem[];
}

const timelineFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'items',
    label: 'Этапы',
    control: 'list',
    itemLabel: 'Этап',
    max: 8,
    itemFields: [
      { key: 'date', label: 'Дата/этап', control: 'text' },
      { key: 'title', label: 'Заголовок', control: 'text' },
      { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
    ],
  },
];

const timelineDefaultProps: TimelineProps = {
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

function TimelineRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TimelineProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles.timeline}>
        {props.items.map((item, index) => (
          <div key={index} className={styles['timeline-item']}>
            <span className={styles['timeline-item__dot']} />
            <div
              className={cn(
                styles['timeline-item__content'],
                index % 2 === 1 && styles['timeline-item__content--alt'],
              )}
            >
              {item.date && <span className={styles['timeline-item__date']}>{item.date}</span>}
              <h3 className={styles['timeline-item__title']}>{item.title}</h3>
              {item.description && (
                <p className={styles['timeline-item__description']}>{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<TimelineProps>({
  type: 'timeline',
  label: 'Хронология',
  category: 'content',
  icon: CalendarIcon,
  description: 'Вертикальная лента событий/этапов в шахматном порядке',
  defaultProps: timelineDefaultProps,
  fields: timelineFields,
  Renderer: TimelineRenderer,
});

function TimelineSimpleRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<TimelineProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        align="left"
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles['timeline-simple']}>
        {props.items.map((item, index) => (
          <div key={index} className={styles['timeline-simple__item']}>
            {item.date && <span className={styles['timeline-simple__date']}>{item.date}</span>}
            <h3 className={styles['timeline-simple__title']}>{item.title}</h3>
            {item.description && (
              <p className={styles['timeline-simple__description']}>{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<TimelineProps>({
  type: 'timelinesimple',
  label: 'Хронология (список)',
  category: 'content',
  icon: RowsIcon,
  description: 'Вертикальный список этапов вдоль одной линии',
  defaultProps: timelineDefaultProps,
  fields: timelineFields,
  Renderer: TimelineSimpleRenderer,
});

// --- Timeline with media -------------------------------------------------
// Не третий вариант `timeline` с тем же `TimelineItem` — здесь у каждого
// этапа есть фото, картинка и текст чередуются сторонами (зигзаг), поэтому
// нужен собственный тип данных (`image`) и собственная раскладка.
// `aspect-ratio` на обёртке фото зафиксирован сразу (не `height: auto` у
// `<img>`) — тот же урок, что и у `imagehotspot` (партия виджетов №5): без
// зарезервированных размеров контейнер до загрузки фото схлопывается.

interface TimelineMediaItem {
  date: string;
  title: string;
  description: string;
  image: string | null;
}

interface TimelineMediaProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: TimelineMediaItem[];
}

function TimelineMediaRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<TimelineMediaProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles['timeline-media']}>
        {props.items.map((item, index) => {
          const alt = index % 2 === 1;
          return (
            <div key={index} className={styles['timeline-media__item']}>
              <div
                className={cn(
                  styles['timeline-media__image-wrap'],
                  alt && styles['timeline-media__image-wrap--alt'],
                )}
              >
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла, не подходит под next/image
                  <img src={item.image} alt="" className={styles['timeline-media__image']} />
                ) : (
                  <div className={styles['timeline-media__image-placeholder']}>
                    <ImageIcon />
                  </div>
                )}
              </div>
              <div className={styles['timeline-media__content']}>
                {item.date && <span className={styles['timeline-media__date']}>{item.date}</span>}
                <h3 className={styles['timeline-media__title']}>{item.title}</h3>
                {item.description && (
                  <p className={styles['timeline-media__description']}>{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

registerBlock<TimelineMediaProps>({
  type: 'timelinemedia',
  label: 'Хронология с фото',
  category: 'content',
  icon: CalendarIcon,
  description: 'Этапы истории с фотографией у каждого, зигзагом',
  defaultProps: {
    eyebrow: 'Как всё было',
    heading: 'Наш путь',
    description: '',
    items: [
      {
        date: '2020',
        title: 'Основание компании',
        description: 'Начали с небольшой команды.',
        image: null,
      },
      {
        date: '2022',
        title: 'Первые 100 клиентов',
        description: 'Вышли на новый рынок.',
        image: null,
      },
      {
        date: '2024',
        title: 'Открыли второй офис',
        description: 'Расширили команду вдвое.',
        image: null,
      },
    ],
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    {
      key: 'items',
      label: 'Этапы',
      control: 'list',
      itemLabel: 'Этап',
      max: 8,
      itemFields: [
        { key: 'image', label: 'Фото', control: 'image' },
        { key: 'date', label: 'Дата/этап', control: 'text' },
        { key: 'title', label: 'Заголовок', control: 'text' },
        { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
      ],
    },
  ],
  Renderer: TimelineMediaRenderer,
});

// --- Tabs ----------------------------------------------------------------

interface TabItem {
  label: string;
  title: string;
  content: string;
}

interface TabsProps {
  eyebrow: string;
  heading: string;
  items: TabItem[];
}

const tabsFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  {
    key: 'items',
    label: 'Вкладки',
    control: 'list',
    itemLabel: 'Вкладка',
    max: 6,
    itemFields: [
      { key: 'label', label: 'Название вкладки', control: 'text' },
      { key: 'title', label: 'Заголовок содержимого', control: 'text' },
      { key: 'content', label: 'Текст', control: 'textarea', rows: 4 },
    ],
  },
];

const tabsDefaultProps: TabsProps = {
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

/** Общий движок `tabs`/`tabsvertical` — переключение активной вкладки живёт
 * здесь (`useState`), оба зарегистрированных типа лишь по-разному
 * располагают список вкладок относительно панели содержимого. */
function TabsBlock({
  props,
  vertical,
  isEditing,
  onEditProp,
}: {
  props: TabsProps;
  vertical: boolean;
  isEditing?: boolean;
  onEditProp?: (key: string, value: unknown) => void;
}) {
  const [active, setActive] = useState(0);
  const activeItem = props.items[active] ?? props.items[0];
  const editable = Boolean(isEditing && onEditProp);

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        align={vertical ? 'left' : 'center'}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={cn(styles.tabs, vertical && styles['tabs--vertical'])}>
        <div
          className={cn(styles['tabs__list'], vertical && styles['tabs__list--vertical'])}
          role="tablist"
          aria-orientation={vertical ? 'vertical' : 'horizontal'}
        >
          {props.items.map((item, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={active === index}
              className={cn(
                styles['tabs__tab'],
                vertical && styles['tabs__tab--vertical'],
                active === index && styles['tabs__tab--active'],
              )}
              onClick={() => setActive(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {activeItem && (
          <div className={styles['tabs__panel']} role="tabpanel">
            {activeItem.title && (
              <h3 className={styles['tabs__panel-title']}>{activeItem.title}</h3>
            )}
            {activeItem.content && (
              <p className={styles['tabs__panel-text']}>{activeItem.content}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TabsProps>) {
  return <TabsBlock props={props} vertical={false} isEditing={isEditing} onEditProp={onEditProp} />;
}

registerBlock<TabsProps>({
  type: 'tabs',
  label: 'Вкладки',
  category: 'content',
  icon: ColumnsIcon,
  description: 'Переключатель контента по горизонтальным вкладкам',
  defaultProps: tabsDefaultProps,
  fields: tabsFields,
  Renderer: TabsRenderer,
});

function TabsVerticalRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TabsProps>) {
  return <TabsBlock props={props} vertical={true} isEditing={isEditing} onEditProp={onEditProp} />;
}

registerBlock<TabsProps>({
  type: 'tabsvertical',
  label: 'Вкладки (боковые)',
  category: 'content',
  icon: GridIcon,
  description: 'Переключатель контента со списком вкладок сбоку',
  defaultProps: tabsDefaultProps,
  fields: tabsFields,
  Renderer: TabsVerticalRenderer,
});

// --- Countdown -------------------------------------------------------------
// Живой отсчёт до `targetDate` — чистый парсинг вынесен в `lib/countdown.ts`
// (юнит-тестируется независимо от React, см. `countdown.test.ts`), здесь
// только `useState`/`useEffect` с `setInterval`. `targetDate` — обычная
// текстовая строка (нет отдельного `control: 'date'` в схеме полей,
// заводить его ради одного блока — за рамками этой партии), поэтому обе
// схемы (`fields` здесь и `add-block-schemas.ts` на backend) держат её как
// `string`/`kind: 'string'` с подсказкой формата в `hint`.
//
// Начальное значение SSR и первый клиентский рендер могут разойтись на
// секунду-другую (сервер и браузер вызывают `new Date()` в разные моменты)
// — `suppressHydrationWarning` стоит именно на текстовых узлах с цифрами, а
// не на контейнере, потому что React учитывает его только на том элементе,
// где он задан напрямую.

const countdownFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'targetDate',
    label: 'Дата и время окончания',
    control: 'text',
    hint: 'Формат: ГГГГ-ММ-ДДTЧЧ:ММ, например 2026-12-31T23:59',
  },
  { key: 'expiredText', label: 'Текст после окончания', control: 'text' },
];

interface CountdownProps {
  eyebrow: string;
  heading: string;
  description: string;
  targetDate: string;
  expiredText: string;
}

const COUNTDOWN_UNITS = [
  ['days', 'дн'],
  ['hours', 'ч'],
  ['minutes', 'мин'],
  ['seconds', 'сек'],
] as const;

/** Разбор оставшегося времени вызывается прямо в теле рендера
 * (`getCountdownParts`), а не хранится в state — эффект здесь только
 * подписывается на «внешние часы» и раз в секунду просит React
 * перерендерить (`forceRerender`), не пишет производное значение в state
 * синхронно самим телом эффекта (см. `react-hooks/set-state-in-effect`:
 * «Subscribe for updates from some external system, calling setState in a
 * callback function» — это ровно тот случай). Общий для `countdown`/
 * `countdownbar`, а не два копипаст-эффекта. */
function useLiveCountdown(targetDate: string): CountdownParts {
  const [, forceRerender] = useState(0);

  useEffect(() => {
    // Уже истёк — тикать вообще не начинаем (страница с таймером старой
    // акции, забытая открытой во вкладке, не должна вечно будить вкладку
    // раз в секунду ради значения, которое больше не меняется).
    if (getCountdownParts(targetDate).isPast) return;

    const id = setInterval(() => {
      if (getCountdownParts(targetDate).isPast) {
        clearInterval(id);
      }
      forceRerender((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return getCountdownParts(targetDate);
}

function CountdownRenderer({ props, isEditing, onEditProp }: BlockRendererProps<CountdownProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const display = useLiveCountdown(props.targetDate);

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      {display.isPast ? (
        <p className={styles['countdown__expired']}>{props.expiredText}</p>
      ) : (
        <div className={styles.countdown}>
          {COUNTDOWN_UNITS.map(([key, label]) => (
            <div key={key} className={styles['countdown__unit']}>
              <span className={styles['countdown__value']} suppressHydrationWarning>
                {String(display[key]).padStart(2, '0')}
              </span>
              <span className={styles['countdown__label']}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

registerBlock<CountdownProps>({
  type: 'countdown',
  label: 'Обратный отсчёт',
  category: 'content',
  icon: ClockIcon,
  description: 'Крупный таймер до даты — акции, запуски, мероприятия',
  defaultProps: {
    eyebrow: 'Ограниченное предложение',
    heading: 'Успейте до конца акции',
    description: '',
    targetDate: '2026-12-31T23:59',
    expiredText: 'Акция завершена',
  },
  fields: countdownFields,
  Renderer: CountdownRenderer,
});

interface CountdownBarProps {
  text: string;
  targetDate: string;
  expiredText: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

function CountdownBarRenderer({ props, pages }: BlockRendererProps<CountdownBarProps>) {
  const display = useLiveCountdown(props.targetDate);

  return (
    <div className={styles['countdown-bar']}>
      <BellIcon className={styles['countdown-bar__icon']} />
      <span className={styles['countdown-bar__text']}>
        {display.isPast ? props.expiredText : props.text}
      </span>
      {!display.isPast && (
        <span className={styles['countdown-bar__timer']} suppressHydrationWarning>
          {formatCountdownCompact(display)}
        </span>
      )}
      {props.buttonLabel && (
        <a href={resolveLinkHref(props.buttonUrl, pages)} className={styles['countdown-bar__link']}>
          {props.buttonLabel}
        </a>
      )}
    </div>
  );
}

registerBlock<CountdownBarProps>({
  type: 'countdownbar',
  label: 'Полоса с таймером',
  category: 'content',
  icon: BellIcon,
  description: 'Компактная полоса-объявление с живым обратным отсчётом',
  defaultProps: {
    text: 'Скидка 20% заканчивается через',
    targetDate: '2026-12-31T23:59',
    expiredText: 'Скидка 20% закончилась',
    buttonLabel: 'Успеть',
    buttonUrl: EMPTY_LINK_TARGET,
  },
  defaultStyle: { background: 'primary', paddingY: 'sm' },
  fields: [
    { key: 'text', label: 'Текст', control: 'text' },
    {
      key: 'targetDate',
      label: 'Дата и время окончания',
      control: 'text',
      hint: 'Формат: ГГГГ-ММ-ДДTЧЧ:ММ, например 2026-12-31T23:59',
    },
    { key: 'expiredText', label: 'Текст после окончания', control: 'text' },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
  ],
  Renderer: CountdownBarRenderer,
});

// --- Logo cloud --------------------------------------------------------

interface LogoCloudItem {
  image: string | null;
  name: string;
  url: LinkTarget;
}

interface LogoCloudProps {
  eyebrow: string;
  heading: string;
  items: LogoCloudItem[];
}

const logoCloudFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  {
    key: 'items',
    label: 'Логотипы',
    control: 'list',
    itemLabel: 'Логотип',
    max: 12,
    itemFields: [
      { key: 'image', label: 'Изображение', control: 'image' },
      { key: 'name', label: 'Название', control: 'text' },
      { key: 'url', label: 'Ссылка (необязательно)', control: 'link' },
    ],
  },
];

const logoCloudDefaultProps: LogoCloudProps = {
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

/** Без картинки — не пустое место и не заглушка-иконка, а название текстом
 * (тот же принцип, что у `RepeatableSimpleCards`: не оборачивать в `<a>`,
 * если ссылки на самом деле нет). */
function LogoCloudLogo({ item, pages }: { item: LogoCloudItem; pages: WebsitePage[] }) {
  const href = resolveLinkHref(item.url, pages);
  const hasLink = href !== '#';
  const content = item.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- логотип партнёра/клиента, произвольный внешний размер, не подходит под next/image
    <img src={item.image} alt={item.name} className={styles['logo-cloud__image']} />
  ) : (
    <span className={styles['logo-cloud__placeholder']}>{item.name}</span>
  );

  return hasLink ? (
    <a href={href} className={styles['logo-cloud__item']} aria-label={item.name}>
      {content}
    </a>
  ) : (
    <div className={styles['logo-cloud__item']}>{content}</div>
  );
}

function LogoCloudRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<LogoCloudProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['logo-cloud']}>
        {props.items.map((item, index) => (
          <LogoCloudLogo key={index} item={item} pages={pages} />
        ))}
      </div>
    </div>
  );
}

registerBlock<LogoCloudProps>({
  type: 'logocloud',
  label: 'Логотипы партнёров',
  category: 'content',
  icon: BuildingIcon,
  description: 'Статичная сетка логотипов клиентов/партнёров',
  defaultProps: logoCloudDefaultProps,
  fields: logoCloudFields,
  Renderer: LogoCloudRenderer,
});

/** Бесконечная лента — трек продублирован ровно один раз (0…n и n…2n),
 * анимация едет от 0 до -50% и зацикливается бесшовно. Второй набор
 * помечен `aria-hidden`, чтобы скринридер не зачитывал те же логотипы
 * дважды. Уважает `prefers-reduced-motion` — см. `content.module.scss`. */
function LogoCloudMarqueeRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<LogoCloudProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['logo-marquee']}>
        <div className={styles['logo-marquee__track']}>
          <div className={styles['logo-marquee__set']}>
            {props.items.map((item, index) => (
              <LogoCloudLogo key={index} item={item} pages={pages} />
            ))}
          </div>
          <div className={styles['logo-marquee__set']} aria-hidden="true">
            {props.items.map((item, index) => (
              <LogoCloudLogo key={index} item={item} pages={pages} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

registerBlock<LogoCloudProps>({
  type: 'logocloudmarquee',
  label: 'Логотипы (бегущая строка)',
  category: 'content',
  icon: GlobeIcon,
  description: 'Логотипы клиентов/партнёров, бесшовно прокручивающиеся по горизонтали',
  defaultProps: logoCloudDefaultProps,
  fields: logoCloudFields,
  Renderer: LogoCloudMarqueeRenderer,
});

// --- Comparison ----------------------------------------------------------

interface ComparisonFeature {
  label: string;
  included: boolean;
}

interface ComparisonPlan {
  name: string;
  highlighted: boolean;
  features: ComparisonFeature[];
}

interface ComparisonProps {
  eyebrow: string;
  heading: string;
  description: string;
  plans: ComparisonPlan[];
}

function ComparisonRenderer({ props, isEditing, onEditProp }: BlockRendererProps<ComparisonProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles.comparison}>
        {props.plans.map((plan, index) => (
          <div
            key={index}
            className={styles['comparison-plan']}
            data-highlighted={plan.highlighted || undefined}
          >
            <span className={styles['comparison-plan__name']}>{plan.name}</span>
            <ul className={styles['comparison-plan__features']}>
              {plan.features.map((feature, i) => (
                <li
                  key={i}
                  className={cn(
                    styles['comparison-plan__feature'],
                    !feature.included && styles['comparison-plan__feature--excluded'],
                  )}
                >
                  {feature.included ? (
                    <CheckIcon className={styles['comparison-plan__feature-icon']} />
                  ) : (
                    <CloseIcon
                      className={cn(
                        styles['comparison-plan__feature-icon'],
                        styles['comparison-plan__feature-icon--excluded'],
                      )}
                    />
                  )}
                  {feature.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<ComparisonProps>({
  type: 'comparison',
  label: 'Сравнение вариантов',
  category: 'content',
  icon: CheckIcon,
  description: 'Карточки вариантов с отметками включённых/невключённых пунктов',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    {
      key: 'plans',
      label: 'Варианты',
      control: 'list',
      itemLabel: 'Вариант',
      max: 4,
      itemFields: [
        { key: 'name', label: 'Название', control: 'text' },
        { key: 'highlighted', label: 'Выделить', control: 'toggle' },
        {
          key: 'features',
          label: 'Пункты сравнения',
          control: 'list',
          itemLabel: 'Пункт',
          max: 12,
          itemFields: [
            { key: 'label', label: 'Текст', control: 'text' },
            { key: 'included', label: 'Включено', control: 'toggle' },
          ],
        },
      ],
    },
  ],
  Renderer: ComparisonRenderer,
});

interface ComparisonSplitRow {
  label: string;
  ours: boolean;
  theirs: boolean;
}

interface ComparisonSplitProps {
  eyebrow: string;
  heading: string;
  description: string;
  oursLabel: string;
  theirsLabel: string;
  rows: ComparisonSplitRow[];
}

function ComparisonSplitRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<ComparisonSplitProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles['comparison-split']} role="table">
        <div className={styles['comparison-split__row']} role="row">
          <span className={styles['comparison-split__cell']} role="columnheader" />
          <span
            className={cn(
              styles['comparison-split__cell'],
              styles['comparison-split__header'],
              styles['comparison-split__header--ours'],
            )}
            role="columnheader"
          >
            {props.oursLabel}
          </span>
          <span
            className={cn(styles['comparison-split__cell'], styles['comparison-split__header'])}
            role="columnheader"
          >
            {props.theirsLabel}
          </span>
        </div>
        {props.rows.map((row, index) => (
          <div key={index} className={styles['comparison-split__row']} role="row">
            <span
              className={cn(styles['comparison-split__cell'], styles['comparison-split__label'])}
              role="rowheader"
            >
              {row.label}
            </span>
            <span
              className={cn(
                styles['comparison-split__cell'],
                styles['comparison-split__value--ours'],
              )}
              role="cell"
            >
              {row.ours ? (
                <CheckIcon className={styles['comparison-split__icon--yes']} />
              ) : (
                <CloseIcon className={styles['comparison-split__icon--no']} />
              )}
            </span>
            <span className={styles['comparison-split__cell']} role="cell">
              {row.theirs ? (
                <CheckIcon className={styles['comparison-split__icon--yes']} />
              ) : (
                <CloseIcon className={styles['comparison-split__icon--no']} />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<ComparisonSplitProps>({
  type: 'comparisonsplit',
  label: 'Сравнение «мы / другие»',
  category: 'content',
  icon: ColumnsIcon,
  description: 'Таблица из двух колонок — чем вы отличаетесь от альтернатив',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    { key: 'oursLabel', label: 'Колонка «Мы»', control: 'text' },
    { key: 'theirsLabel', label: 'Колонка «Другие»', control: 'text' },
    {
      key: 'rows',
      label: 'Критерии',
      control: 'list',
      itemLabel: 'Критерий',
      max: 10,
      itemFields: [
        { key: 'label', label: 'Критерий', control: 'text' },
        { key: 'ours', label: 'У нас', control: 'toggle' },
        { key: 'theirs', label: 'У других', control: 'toggle' },
      ],
    },
  ],
  Renderer: ComparisonSplitRenderer,
});

// --- Progress bars / circles ------------------------------------------

interface ProgressItem {
  label: string;
  percent: number;
}

interface ProgressProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: ProgressItem[];
}

const progressFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'items',
    label: 'Показатели',
    control: 'list',
    itemLabel: 'Показатель',
    max: 8,
    itemFields: [
      { key: 'label', label: 'Название', control: 'text' },
      { key: 'percent', label: 'Процент', control: 'number', min: 0, max: 100 },
    ],
  },
];

const progressDefaultProps: ProgressProps = {
  eyebrow: '',
  heading: 'Наши сильные стороны',
  description: '',
  items: [
    { label: 'Качество', percent: 95 },
    { label: 'Скорость', percent: 88 },
    { label: 'Сервис', percent: 92 },
  ],
};

/** Плавное заполнение при появлении блока — старт анимации через
 * `requestAnimationFrame`-КОЛЛБЭК, не синхронный `setState` в теле эффекта
 * (см. `react-hooks/set-state-in-effect`, тот же приём, что и
 * `useLiveCountdown` выше). Без `IntersectionObserver` — блок анимируется
 * при монтировании/рендере, не строго «когда попал во вьюпорт при
 * прокрутке»: разумное упрощение для этой партии, не пробел. */
function useAnimateOnMount(): boolean {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return animated;
}

function ProgressBarsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<ProgressProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const animated = useAnimateOnMount();

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        align="left"
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles['progress-bars']}>
        {props.items.map((item, index) => (
          <div key={index} className={styles['progress-bar']}>
            <div className={styles['progress-bar__head']}>
              <span>{item.label}</span>
              <span>{item.percent}%</span>
            </div>
            <div className={styles['progress-bar__track']}>
              <div
                className={styles['progress-bar__fill']}
                style={{ width: animated ? `${item.percent}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<ProgressProps>({
  type: 'progressbars',
  label: 'Прогресс-бары',
  category: 'content',
  icon: ChartIcon,
  description: 'Показатели или навыки в виде заполняющихся полос',
  defaultProps: progressDefaultProps,
  fields: progressFields,
  Renderer: ProgressBarsRenderer,
});

const PROGRESS_CIRCLE_RADIUS = 34;
const PROGRESS_CIRCLE_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_CIRCLE_RADIUS;

function ProgressCircleItem({ item, animated }: { item: ProgressItem; animated: boolean }) {
  const offset = PROGRESS_CIRCLE_CIRCUMFERENCE * (1 - (animated ? item.percent : 0) / 100);

  return (
    <div className={styles['progress-circle']}>
      <div className={styles['progress-circle__ring']}>
        <svg viewBox="0 0 80 80" className={styles['progress-circle__svg']}>
          <circle
            cx="40"
            cy="40"
            r={PROGRESS_CIRCLE_RADIUS}
            className={styles['progress-circle__track']}
          />
          <circle
            cx="40"
            cy="40"
            r={PROGRESS_CIRCLE_RADIUS}
            className={styles['progress-circle__value']}
            style={{
              strokeDasharray: PROGRESS_CIRCLE_CIRCUMFERENCE,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <span className={styles['progress-circle__percent']}>{item.percent}%</span>
      </div>
      <span className={styles['progress-circle__label']}>{item.label}</span>
    </div>
  );
}

function ProgressCirclesRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<ProgressProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const animated = useAnimateOnMount();

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles['progress-circles']}>
        {props.items.map((item, index) => (
          <ProgressCircleItem key={index} item={item} animated={animated} />
        ))}
      </div>
    </div>
  );
}

registerBlock<ProgressProps>({
  type: 'progresscircles',
  label: 'Прогресс-кольца',
  category: 'content',
  icon: SparkleIcon,
  description: 'Показатели или навыки в виде круговых индикаторов',
  defaultProps: progressDefaultProps,
  fields: progressFields,
  Renderer: ProgressCirclesRenderer,
});

// --- Sticky bar ----------------------------------------------------------
// `sessionStorage`, не `localStorage` — закрытая полоса должна снова
// появиться в новом визите, не пропасть навсегда (иначе владелец, желающий
// показать её всем, случайно теряет аудиторию, которая заходила однажды и
// закрыла из любопытства). Один общий ключ на весь сайт — упрощение:
// несколько `stickybar`-блоков на разных страницах сегодня делили бы одно
// состояние «закрыто», не независимые — редкий случай (обычно такая полоса
// на сайте одна), не стоящий отдельного id на блок в этой партии.
//
// `position: fixed` только на публичном сайте — канвас билдера рендерит
// блоки в том же документе, без изолирующего `<iframe>` (проверено:
// `widgets/website-builder/ui/*.tsx` его не используют), поэтому `fixed`
// внутри `isEditing` пробил бы холст насквозь и лёг поверх настоящего
// интерфейса билдера (кнопки публикации, инспектора и т. п.), а не остался
// бы «приклеенным» только к превью страницы — тот же класс проблемы, что и
// у `popupoffer` ниже, тем же приёмом решён здесь: модификатор `--preview`
// снимает `fixed` при `isEditing`.

const STICKY_BAR_STORAGE_KEY = 'tavern-site-stickybar-dismissed';

interface StickyBarProps {
  text: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
  dismissible: boolean;
}

function StickyBarRenderer({ props, pages, isEditing }: BlockRendererProps<StickyBarProps>) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isEditing || !props.dismissible) return;
    // `setDismissed` вызывается внутри колбэка `queueMicrotask`, не
    // синхронно в теле самого эффекта (см. `react-hooks/set-state-in-effect`
    // — тот же приём, что и у `useLiveCountdown`/`popupoffer` в этом файле)
    // — здесь это ещё и единственный безопасный способ прочитать
    // `sessionStorage` вообще: значение по умолчанию (`false`) обязано
    // совпасть с тем, что уже отрисовал сервер (там `window` не существует),
    // иначе несовпадение было бы не просто текстом внутри узла
    // (`suppressHydrationWarning` бы не помог), а целым поддеревом —
    // полоса то есть, то её нет.
    queueMicrotask(() => {
      try {
        if (window.sessionStorage.getItem(STICKY_BAR_STORAGE_KEY) === '1') setDismissed(true);
      } catch {
        // Приватный режим/запрещённое хранилище — просто не запоминаем, полоса
        // ведёт себя так, будто ничего не сохраняется (то же честное
        // вырождение, что и у остальных мест этой партии, читающих storage).
      }
    });
  }, [isEditing, props.dismissible]);

  if (dismissed && !isEditing) return null;

  function handleDismiss() {
    setDismissed(true);
    if (!props.dismissible) return;
    try {
      window.sessionStorage.setItem(STICKY_BAR_STORAGE_KEY, '1');
    } catch {
      // См. комментарий выше.
    }
  }

  return (
    <div className={cn(styles['sticky-bar'], isEditing && styles['sticky-bar--preview'])}>
      <span className={styles['sticky-bar__text']}>{props.text}</span>
      {props.buttonLabel && (
        <a href={resolveLinkHref(props.buttonUrl, pages)} className={styles['sticky-bar__link']}>
          {props.buttonLabel}
        </a>
      )}
      {props.dismissible && (
        <button
          type="button"
          className={styles['sticky-bar__close']}
          aria-label="Закрыть полосу"
          onClick={handleDismiss}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

registerBlock<StickyBarProps>({
  type: 'stickybar',
  label: 'Плавающая полоса',
  category: 'content',
  icon: MegaphoneIcon,
  description: 'Прилипающая к низу экрана полоса-объявление с кнопкой',
  defaultProps: {
    text: 'Специальное предложение — успейте до конца недели',
    buttonLabel: 'Подробнее',
    buttonUrl: EMPTY_LINK_TARGET,
    dismissible: true,
  },
  fields: [
    { key: 'text', label: 'Текст', control: 'text' },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
    { key: 'dismissible', label: 'Можно закрыть', control: 'toggle' },
  ],
  Renderer: StickyBarRenderer,
});

// --- Sticky countdown bar --------------------------------------------------
// Не третий вариант `countdown`/`countdownbar` выше — те живут в потоке
// страницы, эта — `position: fixed`, как `stickybar` (тот же `--preview`
// приём и тот же `sessionStorage`-ключ для закрытия, только свой,
// отдельный от `stickybar`, — на одной странице оба могут стоять
// независимо друг от друга). Реальный тикающий таймер — тот же
// `useLiveCountdown`, что у `countdown`/`countdownbar`/`eventcountdown`.

const STICKY_COUNTDOWN_STORAGE_KEY = 'tavern-site-stickycountdownbar-dismissed';

interface StickyCountdownBarProps {
  text: string;
  targetDate: string;
  expiredText: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
  dismissible: boolean;
}

function StickyCountdownBarRenderer({
  props,
  pages,
  isEditing,
}: BlockRendererProps<StickyCountdownBarProps>) {
  const display = useLiveCountdown(props.targetDate);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isEditing || !props.dismissible) return;
    queueMicrotask(() => {
      try {
        if (window.sessionStorage.getItem(STICKY_COUNTDOWN_STORAGE_KEY) === '1') {
          setDismissed(true);
        }
      } catch {
        // Приватный режим/запрещённое хранилище — см. `StickyBarRenderer` выше.
      }
    });
  }, [isEditing, props.dismissible]);

  if ((dismissed || display.isPast) && !isEditing) return null;

  function handleDismiss() {
    setDismissed(true);
    if (!props.dismissible) return;
    try {
      window.sessionStorage.setItem(STICKY_COUNTDOWN_STORAGE_KEY, '1');
    } catch {
      // См. комментарий выше.
    }
  }

  return (
    <div className={cn(styles['sticky-bar'], isEditing && styles['sticky-bar--preview'])}>
      <BellIcon className={styles['countdown-bar__icon']} />
      <span className={styles['sticky-bar__text']}>
        {display.isPast ? props.expiredText : props.text}
      </span>
      {!display.isPast && (
        <span className={styles['countdown-bar__timer']} suppressHydrationWarning>
          {formatCountdownCompact(display)}
        </span>
      )}
      {props.buttonLabel && (
        <a href={resolveLinkHref(props.buttonUrl, pages)} className={styles['sticky-bar__link']}>
          {props.buttonLabel}
        </a>
      )}
      {props.dismissible && (
        <button
          type="button"
          className={styles['sticky-bar__close']}
          aria-label="Закрыть полосу"
          onClick={handleDismiss}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

registerBlock<StickyCountdownBarProps>({
  type: 'stickycountdownbar',
  label: 'Плавающая полоса с таймером',
  category: 'content',
  icon: BellIcon,
  description: 'Прилипающая к низу экрана полоса с живым обратным отсчётом',
  defaultProps: {
    text: 'Скидка 20% заканчивается через',
    targetDate: '2026-12-31T23:59',
    expiredText: 'Скидка 20% закончилась',
    buttonLabel: 'Успеть',
    buttonUrl: EMPTY_LINK_TARGET,
    dismissible: true,
  },
  fields: [
    { key: 'text', label: 'Текст', control: 'text' },
    {
      key: 'targetDate',
      label: 'Дата и время окончания',
      control: 'text',
      hint: 'Формат: ГГГГ-ММ-ДДTЧЧ:ММ, например 2026-12-31T23:59',
    },
    { key: 'expiredText', label: 'Текст после окончания', control: 'text' },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
    { key: 'dismissible', label: 'Можно закрыть', control: 'toggle' },
  ],
  Renderer: StickyCountdownBarRenderer,
});

// --- Exit-intent popup -----------------------------------------------------
// Тот же модальный «карточка + подложка» шаблон, что у `popupoffer` ниже
// (в билдере точно так же без фиксированного фона на весь холст, см. её
// комментарий) — отличается только тем, ЧТО запускает открытие: не таймер,
// а движение курсора к верхней границе окна (типичный признак «сейчас уйдёт
// со страницы»). Показывается максимум один раз за визит — `sessionStorage`,
// тот же приём хранения, что у `StickyBarRenderer`, только флаг «уже
// показывали», а не «закрыли».

const EXIT_INTENT_STORAGE_KEY = 'tavern-site-exitintentpopup-shown';

interface ExitIntentPopupProps {
  heading: string;
  text: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

function ExitIntentPopupRenderer({
  props,
  pages,
  isEditing,
}: BlockRendererProps<ExitIntentPopupProps>) {
  const [open, setOpen] = useState(() => Boolean(isEditing));
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (isEditing) return;

    function handleMouseLeave(event: MouseEvent) {
      if (event.clientY > 0) return;
      try {
        if (window.sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY) === '1') return;
        window.sessionStorage.setItem(EXIT_INTENT_STORAGE_KEY, '1');
      } catch {
        // Приватный режим/запрещённое хранилище — попап всё равно
        // откроется в рамках этой загрузки, просто может повториться при
        // следующей (то же честное вырождение, что у остальных мест этого
        // файла, читающих/пишущих в storage).
      }
      setOpen(true);
    }

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [isEditing]);

  if (!open || closed) return null;

  const card = (
    <div
      className={styles['popup-offer__card']}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal={!isEditing || undefined}
      aria-label={props.heading}
    >
      <button
        type="button"
        className={styles['popup-offer__close']}
        aria-label="Закрыть"
        onClick={() => setClosed(true)}
      >
        <CloseIcon />
      </button>
      {props.heading && <h3 className={styles['popup-offer__heading']}>{props.heading}</h3>}
      {props.text && <p className={styles['popup-offer__text']}>{props.text}</p>}
      {props.buttonLabel && (
        <a href={resolveLinkHref(props.buttonUrl, pages)} className={styles['popup-offer__button']}>
          {props.buttonLabel}
        </a>
      )}
    </div>
  );

  if (isEditing) {
    return <div className={styles['popup-offer__preview']}>{card}</div>;
  }

  return (
    <div className={styles['popup-offer__backdrop']} onClick={() => setClosed(true)}>
      {card}
    </div>
  );
}

registerBlock<ExitIntentPopupProps>({
  type: 'exitintentpopup',
  label: 'Попап при уходе со страницы',
  category: 'content',
  icon: ExternalLinkIcon,
  description: 'Модальное окно, которое открывается, когда курсор уходит к верхней границе окна',
  defaultProps: {
    heading: 'Подождите!',
    text: 'Прежде чем уйти — заберите скидку 10% на первый заказ',
    buttonLabel: 'Забрать скидку',
    buttonUrl: EMPTY_LINK_TARGET,
  },
  fields: [
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'text', label: 'Текст', control: 'textarea', rows: 2 },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
  ],
  Renderer: ExitIntentPopupRenderer,
});

// --- Popup offer -----------------------------------------------------------
// В билдере (`isEditing`) карточка показывается сразу и БЕЗ фиксированного
// фона-подложки на весь холст — иначе редактирование страницы вокруг стало
// бы невозможным (то же соображение, что у `FormBlock`'s «форма не должна
// реально отправляться, пока её редактируют», только про позиционирование,
// не про сетевой эффект). На публичном сайте — настоящее модальное окно с
// задержкой и подложкой.

interface PopupOfferProps {
  heading: string;
  text: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
  delaySeconds: number;
}

function PopupOfferRenderer({ props, pages, isEditing }: BlockRendererProps<PopupOfferProps>) {
  const [open, setOpen] = useState(() => Boolean(isEditing));
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    const id = setTimeout(() => setOpen(true), Math.max(0, props.delaySeconds) * 1000);
    return () => clearTimeout(id);
  }, [isEditing, props.delaySeconds]);

  if (!open || closed) return null;

  const card = (
    <div
      className={styles['popup-offer__card']}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal={!isEditing || undefined}
      aria-label={props.heading}
    >
      <button
        type="button"
        className={styles['popup-offer__close']}
        aria-label="Закрыть"
        onClick={() => setClosed(true)}
      >
        <CloseIcon />
      </button>
      {props.heading && <h3 className={styles['popup-offer__heading']}>{props.heading}</h3>}
      {props.text && <p className={styles['popup-offer__text']}>{props.text}</p>}
      {props.buttonLabel && (
        <a href={resolveLinkHref(props.buttonUrl, pages)} className={styles['popup-offer__button']}>
          {props.buttonLabel}
        </a>
      )}
    </div>
  );

  if (isEditing) {
    return <div className={styles['popup-offer__preview']}>{card}</div>;
  }

  return (
    <div className={styles['popup-offer__backdrop']} onClick={() => setClosed(true)}>
      {card}
    </div>
  );
}

registerBlock<PopupOfferProps>({
  type: 'popupoffer',
  label: 'Всплывающее предложение',
  category: 'content',
  icon: ExternalLinkIcon,
  description: 'Модальное окно с предложением, появляется через паузу после открытия страницы',
  defaultProps: {
    heading: 'Специальное предложение',
    text: 'Оставьте заявку и получите скидку 10%',
    buttonLabel: 'Хочу скидку',
    buttonUrl: EMPTY_LINK_TARGET,
    delaySeconds: 4,
  },
  fields: [
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'text', label: 'Текст', control: 'textarea', rows: 2 },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
    {
      key: 'delaySeconds',
      label: 'Задержка появления (сек)',
      control: 'number',
      min: 0,
      max: 60,
      hint: 'Через сколько секунд после открытия страницы показать окно',
    },
  ],
  Renderer: PopupOfferRenderer,
});

// --- Contact bubble ------------------------------------------------------
// `position: fixed` только вне билдера — то же правило и по той же причине,
// что и у `StickyBarRenderer` выше (канвас без изолирующего `<iframe>`, см.
// её комментарий): в `isEditing` кнопка становится обычным блоком в потоке,
// не приклеенным к вьюпорту, через модификатор `--preview`.

type ContactChannelType = 'whatsapp' | 'telegram' | 'phone' | 'email';

function contactChannelIcon(type: ContactChannelType) {
  if (type === 'phone') return MobileIcon;
  if (type === 'email') return MailIcon;
  return MessagesIcon; // whatsapp/telegram — нет отдельных брендовых иконок в наборе
}

function resolveContactHref(type: ContactChannelType, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  switch (type) {
    case 'whatsapp':
      return `https://wa.me/${trimmed.replace(/[^\d]/g, '')}`;
    case 'telegram':
      return `https://t.me/${trimmed.replace(/^@/, '')}`;
    case 'phone':
      return `tel:${trimmed}`;
    case 'email':
      return `mailto:${trimmed}`;
  }
}

const CONTACT_CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Email' },
];

const CONTACT_POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Справа снизу' },
  { value: 'bottom-left', label: 'Слева снизу' },
];

interface ContactBubbleProps {
  channel: ContactChannelType;
  value: string;
  label: string;
  position: 'bottom-right' | 'bottom-left';
}

function ContactBubbleRenderer({ props, isEditing }: BlockRendererProps<ContactBubbleProps>) {
  if (!props.value.trim()) return null;
  const Icon = contactChannelIcon(props.channel);
  const external = props.channel === 'whatsapp' || props.channel === 'telegram';

  return (
    <a
      href={isEditing ? undefined : resolveContactHref(props.channel, props.value)}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(styles['contact-bubble'], isEditing && styles['contact-bubble--preview'])}
      data-position={props.position}
      aria-label={props.label || 'Написать нам'}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- contactChannelIcon читает стабильную ссылку по switch/case, не создаёт новый компонент на каждый рендер, тот же приём, что и resolveIconChoice в SiteButton (blocks/actions/index.tsx) */}
      <Icon />
      {props.label && <span className={styles['contact-bubble__label']}>{props.label}</span>}
    </a>
  );
}

registerBlock<ContactBubbleProps>({
  type: 'contactbubble',
  label: 'Плавающая кнопка связи',
  category: 'content',
  icon: MessagesIcon,
  description: 'Кнопка WhatsApp/Telegram/телефона/почты, прилипающая к углу экрана',
  defaultProps: {
    channel: 'whatsapp',
    value: '380501234567',
    label: 'Написать в WhatsApp',
    position: 'bottom-right',
  },
  fields: [
    { key: 'channel', label: 'Канал связи', control: 'select', options: CONTACT_CHANNEL_OPTIONS },
    {
      key: 'value',
      label: 'Номер / адрес',
      control: 'text',
      hint: 'Для WhatsApp/Telegram — номер с кодом страны или @username, для телефона — номер, для email — адрес',
    },
    { key: 'label', label: 'Подпись (необязательно)', control: 'text' },
    {
      key: 'position',
      label: 'Расположение',
      control: 'select',
      options: CONTACT_POSITION_OPTIONS,
    },
  ],
  Renderer: ContactBubbleRenderer,
});

interface ContactChannel {
  type: ContactChannelType;
  value: string;
  label: string;
}

interface ContactBubbleMultiProps {
  channels: ContactChannel[];
  position: 'bottom-right' | 'bottom-left';
}

function ContactBubbleMultiRenderer({
  props,
  isEditing,
}: BlockRendererProps<ContactBubbleMultiProps>) {
  const [open, setOpen] = useState(false);
  const channels = props.channels.filter((channel) => channel.value.trim());
  if (channels.length === 0) return null;

  return (
    <div
      className={cn(
        styles['contact-bubble-multi'],
        isEditing && styles['contact-bubble-multi--preview'],
      )}
      data-position={props.position}
    >
      {open && (
        <div className={styles['contact-bubble-multi__list']}>
          {channels.map((channel, index) => {
            const Icon = contactChannelIcon(channel.type);
            const external = channel.type === 'whatsapp' || channel.type === 'telegram';
            return (
              <a
                key={index}
                href={isEditing ? undefined : resolveContactHref(channel.type, channel.value)}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                className={styles['contact-bubble-multi__item']}
              >
                <Icon />
                <span>{channel.label}</span>
              </a>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className={styles['contact-bubble-multi__toggle']}
        aria-label={open ? 'Закрыть' : 'Связаться с нами'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <CloseIcon /> : <PlusIcon />}
      </button>
    </div>
  );
}

registerBlock<ContactBubbleMultiProps>({
  type: 'contactbubblemulti',
  label: 'Плавающее меню связи',
  category: 'content',
  icon: PlusIcon,
  description: 'Разворачивающееся меню из нескольких способов связи в углу экрана',
  defaultProps: {
    channels: [
      { type: 'whatsapp', value: '380501234567', label: 'WhatsApp' },
      { type: 'phone', value: '380501234567', label: 'Позвонить' },
    ],
    position: 'bottom-right',
  },
  fields: [
    {
      key: 'channels',
      label: 'Каналы связи',
      control: 'list',
      itemLabel: 'Канал',
      max: 5,
      itemFields: [
        { key: 'type', label: 'Тип', control: 'select', options: CONTACT_CHANNEL_OPTIONS },
        { key: 'value', label: 'Номер / адрес', control: 'text' },
        { key: 'label', label: 'Подпись', control: 'text' },
      ],
    },
    {
      key: 'position',
      label: 'Расположение',
      control: 'select',
      options: CONTACT_POSITION_OPTIONS,
    },
  ],
  Renderer: ContactBubbleMultiRenderer,
});

// --- Animated stat counters ------------------------------------------------

interface CounterItem {
  icon: string;
  number: number;
  suffix: string;
  label: string;
}

const counterFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  {
    key: 'items',
    label: 'Показатели',
    control: 'list',
    itemLabel: 'Показатель',
    max: 6,
    itemFields: [
      { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
      { key: 'number', label: 'Число', control: 'number', min: 0 },
      { key: 'suffix', label: 'Знак после числа (например +, %)', control: 'text' },
      { key: 'label', label: 'Подпись', control: 'text' },
    ],
  },
];

interface StatsCounterProps {
  eyebrow: string;
  heading: string;
  items: CounterItem[];
}

const statsCounterDefaultProps: StatsCounterProps = {
  eyebrow: '',
  heading: 'Мы в цифрах',
  items: [
    { icon: 'check', number: 500, suffix: '+', label: 'довольных клиентов' },
    { icon: 'star', number: 10, suffix: '', label: 'лет на рынке' },
    { icon: 'heart', number: 98, suffix: '%', label: 'рекомендуют нас' },
  ],
};

/** Считает от 0 до `target` за `durationMs` — `setValue` вызывается только
 * внутри колбэка `requestAnimationFrame` (`tick`), не синхронно в теле
 * самого эффекта (см. `react-hooks/set-state-in-effect`, тот же приём, что
 * у `useAnimateOnMount`/`useLiveCountdown` в этом файле). Как и у
 * `useAnimateOnMount` — считает при монтировании, не при попадании во
 * вьюпорт при скролле (см. её комментарий про `IntersectionObserver`). */
function useCountUp(target: number, durationMs = 1500): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frameId: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * progress));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return value;
}

function CounterItemView({ item, showIcon }: { item: CounterItem; showIcon: boolean }) {
  const value = useCountUp(item.number);
  const Icon = resolveIconChoice(item.icon);

  return (
    <div className={styles['stats-counter__item']}>
      {showIcon && (
        <span className={styles['stats-counter__icon']}>
          {/* eslint-disable-next-line react-hooks/static-components -- resolveIconChoice читает стабильную ссылку из статической карты (см. icon-choices.ts), тот же приём, что и в SiteButton (blocks/actions/index.tsx) */}
          <Icon />
        </span>
      )}
      <span className={styles['stats-counter__number']}>
        {value}
        {item.suffix}
      </span>
      <span className={styles['stats-counter__label']}>{item.label}</span>
    </div>
  );
}

function StatsCounterBlock({
  props,
  showIcon,
  isEditing,
  onEditProp,
}: {
  props: StatsCounterProps;
  showIcon: boolean;
  isEditing?: boolean;
  onEditProp?: (key: string, value: unknown) => void;
}) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['stats-counter']}>
        {props.items.map((item, index) => (
          <CounterItemView key={index} item={item} showIcon={showIcon} />
        ))}
      </div>
    </div>
  );
}

function StatsCounterRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<StatsCounterProps>) {
  return (
    <StatsCounterBlock
      props={props}
      showIcon={false}
      isEditing={isEditing}
      onEditProp={onEditProp}
    />
  );
}

registerBlock<StatsCounterProps>({
  type: 'statscounter',
  label: 'Счётчики (анимация)',
  category: 'content',
  icon: ChartIcon,
  description: 'Крупные цифры, отсчитывающиеся от нуля при появлении на странице',
  defaultProps: statsCounterDefaultProps,
  fields: counterFields,
  Renderer: StatsCounterRenderer,
});

function StatsCounterIconsRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<StatsCounterProps>) {
  return (
    <StatsCounterBlock
      props={props}
      showIcon={true}
      isEditing={isEditing}
      onEditProp={onEditProp}
    />
  );
}

registerBlock<StatsCounterProps>({
  type: 'statscountericons',
  label: 'Счётчики с иконками',
  category: 'content',
  icon: TagIcon,
  description: 'Анимированные цифры с иконкой над каждым показателем',
  defaultProps: statsCounterDefaultProps,
  fields: counterFields,
  Renderer: StatsCounterIconsRenderer,
});

// --- Portfolio grid / masonry ----------------------------------------------
// Общий движок `portfoliogrid`/`portfoliomasonry` — различаются раскладкой
// (равномерная сетка vs колонки переменной высоты). Модификатор варианта —
// на самом элементе (`variant === 'masonry' && styles[...]`), не через
// вложенный селектор-потомок вида `.portfolio-masonry .portfolio-card__image`
// — та же дисциплина, что уже применена в §51 после самостоятельного
// ревью (`AGENTS.md` §6: вложенность через `&` только для состояний своего
// же селектора).

interface PortfolioItem {
  image: string | null;
  title: string;
  category: string;
  url: LinkTarget;
}

interface PortfolioProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: PortfolioItem[];
  columns: number;
}

const portfolioFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'items',
    label: 'Работы',
    control: 'list',
    itemLabel: 'Работа',
    itemFields: [
      { key: 'image', label: 'Изображение', control: 'image' },
      { key: 'title', label: 'Название', control: 'text' },
      { key: 'category', label: 'Категория', control: 'text' },
      { key: 'url', label: 'Ссылка (необязательно)', control: 'link' },
    ],
  },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

const portfolioDefaultProps: PortfolioProps = {
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

function PortfolioCard({
  item,
  pages,
  masonry,
}: {
  item: PortfolioItem;
  pages: WebsitePage[];
  masonry: boolean;
}) {
  const href = resolveLinkHref(item.url, pages);
  const hasLink = href !== '#';

  const content = (
    <>
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла
        <img
          src={item.image}
          alt=""
          className={cn(
            styles['portfolio-card__image'],
            masonry && styles['portfolio-card__image--natural'],
          )}
        />
      )}
      <div className={styles['portfolio-card__overlay']}>
        {item.category && (
          <span className={styles['portfolio-card__category']}>{item.category}</span>
        )}
        <span className={styles['portfolio-card__title']}>{item.title}</span>
      </div>
    </>
  );

  const cardClassName = cn(styles['portfolio-card'], masonry && styles['portfolio-card--masonry']);

  return hasLink ? (
    <a href={href} className={cardClassName}>
      {content}
    </a>
  ) : (
    <div className={cardClassName} tabIndex={0}>
      {content}
    </div>
  );
}

function PortfolioBlock({
  props,
  pages,
  masonry,
  isEditing,
  onEditProp,
}: BlockRendererProps<PortfolioProps> & { masonry: boolean }) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div
        className={styles[masonry ? 'portfolio-masonry' : 'portfolio-grid']}
        style={{ '--grid-columns': props.columns } as CSSProperties}
      >
        {props.items.map((item, index) => (
          <PortfolioCard key={index} item={item} pages={pages} masonry={masonry} />
        ))}
      </div>
    </div>
  );
}

function PortfolioGridRenderer(rendererProps: BlockRendererProps<PortfolioProps>) {
  return <PortfolioBlock {...rendererProps} masonry={false} />;
}

registerBlock<PortfolioProps>({
  type: 'portfoliogrid',
  label: 'Портфолио (сетка)',
  category: 'content',
  icon: GridIcon,
  description: 'Сетка работ с затемнением и подписью при наведении',
  defaultProps: portfolioDefaultProps,
  fields: portfolioFields,
  Renderer: PortfolioGridRenderer,
});

function PortfolioMasonryRenderer(rendererProps: BlockRendererProps<PortfolioProps>) {
  return <PortfolioBlock {...rendererProps} masonry={true} />;
}

registerBlock<PortfolioProps>({
  type: 'portfoliomasonry',
  label: 'Портфолио (плитка разной высоты)',
  category: 'content',
  icon: RowsIcon,
  description: 'Колонки переменной высоты в стиле Pinterest, с подписью при наведении',
  defaultProps: portfolioDefaultProps,
  fields: portfolioFields,
  Renderer: PortfolioMasonryRenderer,
});

// --- Cookie consent bar ------------------------------------------------
// `localStorage`, не `sessionStorage` — в отличие от `stickybar` (промо,
// должно снова появляться в новом визите), решение о cookie-согласии
// осмысленно именно тогда, когда оно запоминается надолго: спрашивать
// заново при каждом новом визите было бы навязчиво и противоречило бы
// самой цели баннера. `position: fixed` только вне билдера — тот же приём
// и та же причина, что у `StickyBarRenderer`/`ContactBubbleRenderer` выше.

const COOKIE_BAR_STORAGE_KEY = 'tavern-site-cookie-consent';

interface CookieBarProps {
  text: string;
  acceptLabel: string;
  declineLabel: string;
}

function CookieBarRenderer({ props, isEditing }: BlockRendererProps<CookieBarProps>) {
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    queueMicrotask(() => {
      try {
        if (window.localStorage.getItem(COOKIE_BAR_STORAGE_KEY)) setAnswered(true);
      } catch {
        // Приватный режим/запрещённое хранилище — решение просто не
        // запомнится, баннер будет показываться заново, честное вырождение.
      }
    });
  }, [isEditing]);

  if (answered && !isEditing) return null;

  function respond(value: 'accepted' | 'declined') {
    setAnswered(true);
    try {
      window.localStorage.setItem(COOKIE_BAR_STORAGE_KEY, value);
    } catch {
      // См. комментарий выше.
    }
  }

  return (
    <div className={cn(styles['cookie-bar'], isEditing && styles['cookie-bar--preview'])}>
      <span className={styles['cookie-bar__text']}>{props.text}</span>
      <div className={styles['cookie-bar__actions']}>
        <button
          type="button"
          className={styles['cookie-bar__decline']}
          onClick={() => respond('declined')}
        >
          {props.declineLabel}
        </button>
        <button
          type="button"
          className={styles['cookie-bar__accept']}
          onClick={() => respond('accepted')}
        >
          {props.acceptLabel}
        </button>
      </div>
    </div>
  );
}

registerBlock<CookieBarProps>({
  type: 'cookiebar',
  label: 'Согласие на cookie',
  category: 'content',
  icon: ShieldIcon,
  description: 'Полоса согласия на использование cookie с кнопками принять/отклонить',
  defaultProps: {
    text: 'Мы используем файлы cookie, чтобы сайт работал лучше.',
    acceptLabel: 'Принять',
    declineLabel: 'Отклонить',
  },
  fields: [
    { key: 'text', label: 'Текст', control: 'textarea', rows: 2 },
    { key: 'acceptLabel', label: 'Текст кнопки согласия', control: 'text' },
    { key: 'declineLabel', label: 'Текст кнопки отказа', control: 'text' },
  ],
  Renderer: CookieBarRenderer,
});

interface CookieBarMinimalProps {
  text: string;
  okLabel: string;
}

function CookieBarMinimalRenderer({ props, isEditing }: BlockRendererProps<CookieBarMinimalProps>) {
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    queueMicrotask(() => {
      try {
        if (window.localStorage.getItem(COOKIE_BAR_STORAGE_KEY)) setAnswered(true);
      } catch {
        // См. комментарий у CookieBarRenderer.
      }
    });
  }, [isEditing]);

  if (answered && !isEditing) return null;

  function respond() {
    setAnswered(true);
    try {
      window.localStorage.setItem(COOKIE_BAR_STORAGE_KEY, 'accepted');
    } catch {
      // См. комментарий у CookieBarRenderer.
    }
  }

  return (
    <div className={cn(styles['cookie-bar'], isEditing && styles['cookie-bar--preview'])}>
      <span className={styles['cookie-bar__text']}>{props.text}</span>
      <div className={styles['cookie-bar__actions']}>
        <button type="button" className={styles['cookie-bar__accept']} onClick={respond}>
          {props.okLabel}
        </button>
      </div>
    </div>
  );
}

registerBlock<CookieBarMinimalProps>({
  type: 'cookiebarminimal',
  label: 'Уведомление о cookie',
  category: 'content',
  icon: ShieldIcon,
  description: 'Короткое уведомление о cookie с одной кнопкой «Ок»',
  defaultProps: {
    text: 'Мы используем файлы cookie для удобства работы сайта.',
    okLabel: 'Понятно',
  },
  fields: [
    { key: 'text', label: 'Текст', control: 'textarea', rows: 2 },
    { key: 'okLabel', label: 'Текст кнопки', control: 'text' },
  ],
  Renderer: CookieBarMinimalRenderer,
});

// --- Scarcity bar ----------------------------------------------------------
// Числа — свободно вписанные владельцем (`claimed`/`total`), не подсчитаны
// системой (на сайте нет живого счётчика заказов на блок) — та же честная
// граница, что и у `pricing.plan.price`/`ratingsummary` (партия виджетов
// №5): это НЕ имитация «живой» активности (поддельные всплывающие «кто-то
// только что купил» сознательно не делались в партии №5 именно из-за этого),
// а обычный статический индикатор, который владелец обновляет сам.

interface ScarcityBarProps {
  label: string;
  claimed: number;
  total: number;
}

function ScarcityBarRenderer({ props }: BlockRendererProps<ScarcityBarProps>) {
  const percent =
    props.total > 0 ? Math.min(100, Math.round((props.claimed / props.total) * 100)) : 0;

  return (
    <div className={styles['scarcity-bar']}>
      <div className={styles['scarcity-bar__track']}>
        <div className={styles['scarcity-bar__fill']} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles['scarcity-bar__label']}>
        {props.label} — {props.claimed} из {props.total}
      </span>
    </div>
  );
}

registerBlock<ScarcityBarProps>({
  type: 'scarcitybar',
  label: 'Полоса дефицита',
  category: 'content',
  icon: ChartIcon,
  description: 'Индикатор «осталось мало» — прогресс-бар с числом занятых мест',
  defaultProps: {
    label: 'Осталось мало мест',
    claimed: 78,
    total: 100,
  },
  fields: [
    { key: 'label', label: 'Текст', control: 'text' },
    { key: 'claimed', label: 'Занято', control: 'number', min: 0 },
    { key: 'total', label: 'Всего', control: 'number', min: 1 },
  ],
  Renderer: ScarcityBarRenderer,
});

// --- Coupon code -----------------------------------------------------------
// Реальное копирование в буфер — тот же приём (и та же честная деградация
// в `catch`, если буфер недоступен), что и у `SocialShareRenderer`
// (`blocks/business/index.tsx`), не третья независимая реализация.

interface CouponCodeProps {
  label: string;
  code: string;
  description: string;
}

function CouponCodeRenderer({ props }: BlockRendererProps<CouponCodeProps>) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен (нет разрешения/не HTTPS-контекст) — честная
      // деградация, см. `SocialShareRenderer` в `blocks/business/index.tsx`.
    }
  }

  return (
    <div className={styles['coupon-code']}>
      {props.label && <span className={styles['coupon-code__label']}>{props.label}</span>}
      <button type="button" className={styles['coupon-code__code']} onClick={handleCopy}>
        <span>{props.code}</span>
        <CopyIcon />
      </button>
      {props.description && (
        <span className={styles['coupon-code__description']}>{props.description}</span>
      )}
      {copied && <span className={styles['coupon-code__copied']}>Скопировано!</span>}
    </div>
  );
}

registerBlock<CouponCodeProps>({
  type: 'couponcode',
  label: 'Промокод',
  category: 'content',
  icon: TagIcon,
  description: 'Промокод с кнопкой «скопировать» в один клик',
  defaultProps: {
    label: 'Промокод',
    code: 'WELCOME10',
    description: 'Скидка 10% на первый заказ',
  },
  fields: [
    { key: 'label', label: 'Надпись сверху', control: 'text' },
    { key: 'code', label: 'Код', control: 'text' },
    { key: 'description', label: 'Описание', control: 'text' },
  ],
  Renderer: CouponCodeRenderer,
});

// --- Event countdown ---------------------------------------------------
// Не третий вариант `countdown`/`countdownbar` — у тех цель просто «успеть
// до X», здесь целевая дата — РЕАЛЬНОЕ мероприятие с длительностью и
// кнопкой «добавить в календарь» (готовая ссылка Google Calendar,
// построенная из даты/названия — чистая функция от `props`, детерминирована
// на сервере и клиенте одинаково, поэтому безопасна прямо в теле рендера,
// без эффекта). Компактный текстовый отсчёт через уже существующий
// `formatCountdownCompact` (`lib/countdown.ts`), не свой собственный набор
// цифровых плашек, как у `countdown`.

interface EventCountdownProps {
  eyebrow: string;
  heading: string;
  description: string;
  eventTitle: string;
  targetDate: string;
  durationMinutes: number;
  addToCalendarLabel: string;
  expiredText: string;
}

function toGoogleCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildGoogleCalendarUrl(
  title: string,
  targetDate: string,
  durationMinutes: number,
): string {
  const start = new Date(targetDate);
  if (!Number.isFinite(start.getTime())) return '';
  const end = new Date(start.getTime() + Math.max(0, durationMinutes) * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${toGoogleCalendarStamp(start)}/${toGoogleCalendarStamp(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function EventCountdownRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<EventCountdownProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const display = useLiveCountdown(props.targetDate);
  const calendarUrl = buildGoogleCalendarUrl(
    props.eventTitle,
    props.targetDate,
    props.durationMinutes,
  );

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
      <div className={styles['event-countdown']}>
        <span className={styles['event-countdown__timer']} suppressHydrationWarning>
          {display.isPast ? props.expiredText : formatCountdownCompact(display)}
        </span>
        {!display.isPast && calendarUrl && props.addToCalendarLabel && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['event-countdown__calendar-link']}
          >
            <CalendarIcon />
            {props.addToCalendarLabel}
          </a>
        )}
      </div>
    </div>
  );
}

registerBlock<EventCountdownProps>({
  type: 'eventcountdown',
  label: 'Отсчёт до мероприятия',
  category: 'content',
  icon: CalendarIcon,
  description: 'Обратный отсчёт до реального события с кнопкой «добавить в календарь»',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    { key: 'eventTitle', label: 'Название события (для календаря)', control: 'text' },
    {
      key: 'targetDate',
      label: 'Дата и время начала',
      control: 'text',
      hint: 'Формат: ГГГГ-ММ-ДДTЧЧ:ММ, например 2026-12-31T18:00',
    },
    { key: 'durationMinutes', label: 'Длительность (мин)', control: 'number', min: 5, max: 1440 },
    { key: 'addToCalendarLabel', label: 'Текст кнопки календаря', control: 'text' },
    { key: 'expiredText', label: 'Текст после окончания', control: 'text' },
  ],
  Renderer: EventCountdownRenderer,
});

// --- Pros / cons -----------------------------------------------------------

interface ProsConsItem {
  text: string;
}

interface ProsConsProps {
  eyebrow: string;
  heading: string;
  prosTitle: string;
  consTitle: string;
  pros: ProsConsItem[];
  cons: ProsConsItem[];
}

function ProsConsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<ProsConsProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['pros-cons']}>
        <div className={styles['pros-cons__column']}>
          <span className={styles['pros-cons__column-title']}>{props.prosTitle}</span>
          <ul className={styles['pros-cons__list']}>
            {props.pros.map((item, index) => (
              <li key={index} className={styles['pros-cons__item--pro']}>
                <CheckIcon />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles['pros-cons__column']}>
          <span className={styles['pros-cons__column-title']}>{props.consTitle}</span>
          <ul className={styles['pros-cons__list']}>
            {props.cons.map((item, index) => (
              <li key={index} className={styles['pros-cons__item--con']}>
                <CloseIcon />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

registerBlock<ProsConsProps>({
  type: 'proscons',
  label: 'Плюсы и минусы',
  category: 'content',
  icon: ColumnsIcon,
  description: 'Две колонки — что входит и чего нет',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'prosTitle', label: 'Заголовок колонки плюсов', control: 'text' },
    { key: 'consTitle', label: 'Заголовок колонки минусов', control: 'text' },
    {
      key: 'pros',
      label: 'Плюсы',
      control: 'list',
      itemLabel: 'Пункт',
      max: 10,
      itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
    },
    {
      key: 'cons',
      label: 'Минусы',
      control: 'list',
      itemLabel: 'Пункт',
      max: 10,
      itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
    },
  ],
  Renderer: ProsConsRenderer,
});

// --- Callout box -----------------------------------------------------------

interface CalloutBoxProps {
  icon: string;
  variant: 'info' | 'success' | 'warning';
  text: string;
}

function CalloutBoxRenderer({ props }: BlockRendererProps<CalloutBoxProps>) {
  const Icon = resolveIconChoice(props.icon);

  return (
    <div className={cn(styles['callout-box'], styles[`callout-box--${props.variant}`])}>
      {/* eslint-disable-next-line react-hooks/static-components -- иконка выбирается по данным, не статический компонент, то же осознанное отклонение, что и в blocks/actions/index.tsx */}
      <Icon className={styles['callout-box__icon']} />
      <p className={styles['callout-box__text']}>{props.text}</p>
    </div>
  );
}

registerBlock<CalloutBoxProps>({
  type: 'calloutbox',
  label: 'Заметка',
  category: 'content',
  icon: ShieldIcon,
  description: 'Цветной блок с иконкой для важного примечания',
  defaultProps: {
    icon: 'shield',
    variant: 'info',
    text: 'Важно: ознакомьтесь с условиями перед покупкой.',
  },
  fields: [
    { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
    {
      key: 'variant',
      label: 'Тип',
      control: 'segmented',
      options: [
        { value: 'info', label: 'Инфо' },
        { value: 'success', label: 'Успех' },
        { value: 'warning', label: 'Внимание' },
      ],
    },
    { key: 'text', label: 'Текст', control: 'textarea', rows: 2 },
  ],
  Renderer: CalloutBoxRenderer,
});

// --- Data table --------------------------------------------------------
// Первый по-настоящему табличный виджет во всём реестре — раньше сравнения
// делали только `comparison`/`comparisonsplit` (жёстко «план × функция»).
// Здесь произвольная сетка текста, для чего угодно (характеристики,
// расписание, прайс-лист). `.data-table__wrap` со своим `overflow-x: auto`
// обязателен (см. `AGENTS.md`: широкий контент должен скроллиться в своём
// контейнере, а не ломать ширину страницы).

interface DataTableCell {
  text: string;
}

interface DataTableRow {
  cells: DataTableCell[];
}

interface DataTableProps {
  eyebrow: string;
  heading: string;
  headers: DataTableCell[];
  rows: DataTableRow[];
}

function DataTableRenderer({ props, isEditing, onEditProp }: BlockRendererProps<DataTableProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        align="left"
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['data-table__wrap']}>
        <table className={styles['data-table']}>
          {props.headers.length > 0 && (
            <thead>
              <tr>
                {props.headers.map((cell, index) => (
                  <th key={index}>{cell.text}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {props.rows.map((row, index) => (
              <tr key={index}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell.text}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

registerBlock<DataTableProps>({
  type: 'datatable',
  label: 'Таблица',
  category: 'content',
  icon: RowsIcon,
  description: 'Произвольная таблица — характеристики, расписание, прайс-лист',
  defaultProps: {
    eyebrow: '',
    heading: 'Сравнение характеристик',
    headers: [{ text: 'Характеристика' }, { text: 'Базовый' }, { text: 'Премиум' }],
    rows: [
      { cells: [{ text: 'Поддержка' }, { text: 'Email' }, { text: '24/7' }] },
      { cells: [{ text: 'Хранилище' }, { text: '10 ГБ' }, { text: '100 ГБ' }] },
    ],
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'headers',
      label: 'Заголовки колонок',
      control: 'list',
      itemLabel: 'Колонка',
      max: 8,
      itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
    },
    {
      key: 'rows',
      label: 'Строки',
      control: 'list',
      itemLabel: 'Строка',
      max: 20,
      itemFields: [
        {
          key: 'cells',
          label: 'Ячейки',
          control: 'list',
          itemLabel: 'Ячейка',
          max: 8,
          itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
        },
      ],
    },
  ],
  Renderer: DataTableRenderer,
});

// --- Quiz (single question, branching result) ---------------------------
// Одна страница — один вопрос, каждый вариант ведёт к своему тексту
// результата, без ветвления на несколько вопросов подряд (для этого
// потребовалась бы отдельная модель состояния «текущий шаг», которую здесь
// сознательно не строят впрок — реальный запрос был именно на «один
// вопрос, разный совет по ответу»).

interface QuizChoice {
  label: string;
  resultText: string;
}

interface QuizSingleProps {
  eyebrow: string;
  question: string;
  choices: QuizChoice[];
  restartLabel: string;
}

function QuizSingleRenderer({ props, isEditing, onEditProp }: BlockRendererProps<QuizSingleProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [selected, setSelected] = useState<number | null>(null);
  const result = selected !== null ? props.choices[selected] : undefined;

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.question}
        align="left"
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('question', value)}
      />
      {result ? (
        <div className={styles['quiz__result']}>
          <p>{result.resultText}</p>
          <button
            type="button"
            className={styles['quiz__restart']}
            onClick={() => setSelected(null)}
          >
            {props.restartLabel}
          </button>
        </div>
      ) : (
        <div className={styles.quiz}>
          {props.choices.map((choice, index) => (
            <button
              key={index}
              type="button"
              className={styles['quiz__choice']}
              onClick={() => setSelected(index)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

registerBlock<QuizSingleProps>({
  type: 'quizsingle',
  label: 'Мини-тест',
  category: 'content',
  icon: MessagesIcon,
  description: 'Один вопрос с вариантами ответа — под каждый вариант свой результат',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'question', label: 'Вопрос', control: 'text' },
    {
      key: 'choices',
      label: 'Варианты ответа',
      control: 'list',
      itemLabel: 'Вариант',
      max: 6,
      itemFields: [
        { key: 'label', label: 'Текст варианта', control: 'text' },
        { key: 'resultText', label: 'Результат для этого варианта', control: 'textarea', rows: 2 },
      ],
    },
    { key: 'restartLabel', label: 'Текст кнопки «пройти ещё раз»', control: 'text' },
  ],
  Renderer: QuizSingleRenderer,
});

// --- Stats hero (single big animated number) --------------------------
// Не третий вариант `statscounter`/`statscountericons` — те показывают
// НЕСКОЛЬКО цифр в ряд, здесь ровно ОДНА, крупно, как самостоятельный
// акцент секции (тот же принцип «спотлайт вместо сетки», что у
// `quotespotlight`/`pricingsingle`). Переиспользует тот же `useCountUp`,
// что и `statscounter` (объявлен выше в этом файле), не считает заново.

interface StatsHeroProps {
  eyebrow: string;
  number: number;
  suffix: string;
  label: string;
}

function StatsHeroRenderer({ props }: BlockRendererProps<StatsHeroProps>) {
  const value = useCountUp(props.number, 2000);

  return (
    <div className={styles['stats-hero']}>
      {props.eyebrow && <span className={styles['stats-hero__eyebrow']}>{props.eyebrow}</span>}
      <span className={styles['stats-hero__number']}>
        {value}
        {props.suffix}
      </span>
      <span className={styles['stats-hero__label']}>{props.label}</span>
    </div>
  );
}

registerBlock<StatsHeroProps>({
  type: 'statshero',
  label: 'Крупная цифра',
  category: 'content',
  icon: ChartIcon,
  description: 'Одна крупная анимированная цифра как акцент секции',
  defaultProps: {
    eyebrow: '',
    number: 10000,
    suffix: '+',
    label: 'довольных клиентов по всему миру',
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'number', label: 'Число', control: 'number', min: 0 },
    { key: 'suffix', label: 'Суффикс (например, «+»)', control: 'text' },
    { key: 'label', label: 'Подпись', control: 'text' },
  ],
  Renderer: StatsHeroRenderer,
});
