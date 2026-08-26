import { ChartIcon, GridIcon, MegaphoneIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { EMPTY_LINK_TARGET, resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget } from '../../model/types';
import { RepeatableIconCards } from '../shared/RepeatableIconCards';
import { RepeatableSimpleCards } from '../shared/RepeatableSimpleCards';
import { ICON_CHOICE_OPTIONS } from '../shared/icon-choices';
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

function FeatureGridRenderer({ props }: BlockRendererProps<FeatureGridProps>) {
  return <RepeatableIconCards {...props} />;
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

function CardsRenderer({ props, pages }: BlockRendererProps<SimpleCardsProps>) {
  return <RepeatableSimpleCards {...props} pages={pages} />;
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

function ArticlesRenderer({ props, pages }: BlockRendererProps<SimpleCardsProps>) {
  return <RepeatableSimpleCards {...props} pages={pages} />;
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

function StatsRenderer({ props }: BlockRendererProps<StatsProps>) {
  return (
    <div className={styles.block}>
      <SectionHeading eyebrow={props.eyebrow} heading={props.heading} />
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

function BannerRenderer({ props, pages }: BlockRendererProps<BannerProps>) {
  return (
    <div className={styles.banner}>
      <MegaphoneIcon className={styles['banner__icon']} />
      <span className={styles['banner__text']}>{props.text}</span>
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
