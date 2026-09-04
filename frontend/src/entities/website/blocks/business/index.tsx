'use client';

import { useState } from 'react';
import {
  ChevronDownIcon,
  ClockIcon,
  GlobeIcon,
  ImageIcon,
  LocationIcon,
  MailIcon,
} from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';
import { Popover } from '@/shared/ui/Popover';
import { useParallaxOffset } from '../../lib/use-parallax-offset';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { EMPTY_LINK_TARGET, resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget } from '../../model/types';
import { RepeatableIconCards } from '../shared/RepeatableIconCards';
import { RepeatablePeopleCards } from '../shared/RepeatablePeopleCards';
import { ICON_CHOICE_OPTIONS, resolveIconChoice } from '../shared/icon-choices';
import { SectionHeading } from '../shared/SectionHeading';
import { HeaderActions } from './HeaderActions';
import styles from './business.module.scss';

// --- Business Header ---------------------------------------------------
// Свёрнутые вместе «Header»/«Navbar»/«Business Header» из ТЗ (см. корневой
// план фичи, раздел про упрощения) — один блок навигации сайта, сам
// подставляет лого и имя бизнеса, пользователь настраивает только ссылки
// меню. `children` у пункта меню (простой одноуровневый дропдаун, не
// многоколоночное мега-меню — см. AI_PLATFORM_ROADMAP.md, партия «шапка с
// попапами») переиспользует ту же рекурсивную поддержку `control: 'list'`
// внутри `itemFields`, что уже есть у `FieldControl.tsx` — новой
// инфраструктуры инспектора для этого не потребовалось.

interface SubNavLink {
  label: string;
  url: LinkTarget;
}

interface NavLink {
  label: string;
  url: LinkTarget;
  children?: SubNavLink[];
}

interface BusinessHeaderProps {
  navLinks: NavLink[];
  showSearch: boolean;
  showFavorites: boolean;
  showCart: boolean;
}

interface NavItemProps {
  link: NavLink;
  pages: BlockRendererProps<BusinessHeaderProps>['pages'];
}

function NavItem({ link, pages }: NavItemProps) {
  if (!link.children || link.children.length === 0) {
    return <a href={resolveLinkHref(link.url, pages)}>{link.label}</a>;
  }

  return (
    <Popover
      panelLabel={link.label}
      panelClassName={styles['biz-header__dropdown']}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          className={styles['biz-header__navButton']}
          aria-expanded={open}
          onClick={toggle}
        >
          {link.label}
          <ChevronDownIcon />
        </button>
      )}
    >
      {() => (
        <div className={styles['biz-header__dropdownList']}>
          {link.children?.map((child, index) => (
            <a key={index} href={resolveLinkHref(child.url, pages)}>
              {child.label}
            </a>
          ))}
        </div>
      )}
    </Popover>
  );
}

function BusinessHeaderRenderer({
  props,
  business,
  pages,
  isEditing,
}: BlockRendererProps<BusinessHeaderProps>) {
  return (
    <header className={styles['biz-header']}>
      <span className={styles['biz-header__brand']}>
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- логотип бизнеса
          <img src={business.logoUrl} alt="" className={styles['biz-header__logo']} />
        ) : null}
        {business.name}
      </span>
      {props.navLinks.length > 0 && (
        <nav className={styles['biz-header__nav']}>
          {props.navLinks.map((link, index) => (
            <NavItem key={index} link={link} pages={pages} />
          ))}
        </nav>
      )}
      <HeaderActions
        businessId={business.businessId}
        // `?? true`/`?? false` — та же пара значений, что и `defaultProps`
        // ниже, но `defaultProps` подставляется только при СОЗДАНИИ блока
        // (`add_block`/библиотека компонентов); сайты, чей `businessheader`
        // сохранён ДО появления этих трёх полей, хранят `props` вообще без
        // них — без фолбэка `props.showSearch` было бы `undefined`, все три
        // читались бы как `false`, и `HeaderActions` целиком скрывал бы
        // строку действий (`if (!showSearch && !showFavorites && !showCart)
        // return null`) на каждом уже существующем сайте.
        showSearch={props.showSearch ?? true}
        showFavorites={props.showFavorites ?? true}
        showCart={props.showCart ?? false}
        isEditing={isEditing}
      />
    </header>
  );
}

const businessHeaderFields: FieldSchema[] = [
  {
    key: 'navLinks',
    label: 'Пункты меню',
    control: 'list',
    itemLabel: 'Пункт меню',
    max: 6,
    itemFields: [
      { key: 'label', label: 'Текст', control: 'text' },
      { key: 'url', label: 'Ссылка', control: 'link' },
      {
        key: 'children',
        label: 'Подпункты (выпадающий список)',
        control: 'list',
        itemLabel: 'Подпункт',
        max: 6,
        itemFields: [
          { key: 'label', label: 'Текст', control: 'text' },
          { key: 'url', label: 'Ссылка', control: 'link' },
        ],
      },
    ],
  },
  { key: 'showSearch', label: 'Кнопка поиска', control: 'toggle' },
  { key: 'showFavorites', label: 'Кнопка «Избранное»', control: 'toggle' },
  { key: 'showCart', label: 'Кнопка «Корзина»', control: 'toggle' },
];

registerBlock<BusinessHeaderProps>({
  type: 'businessheader',
  label: 'Шапка сайта',
  category: 'business',
  icon: GlobeIcon,
  description: 'Лого, название, меню и кнопки — верх страницы',
  defaultProps: {
    navLinks: [
      { label: 'О нас', url: { type: 'anchor', anchor: 'about' } },
      { label: 'Услуги', url: { type: 'anchor', anchor: 'services' } },
      { label: 'Контакты', url: { type: 'anchor', anchor: 'contact' } },
    ],
    showSearch: true,
    showFavorites: true,
    showCart: false,
  },
  fields: businessHeaderFields,
  Renderer: BusinessHeaderRenderer,
});

// --- Hero ------------------------------------------------------------------

interface HeroProps {
  eyebrow: string;
  heading: string;
  description: string;
  backgroundImage: string | null;
  /** Только когда `backgroundImage` заполнен — фон едет медленнее контента
   * при прокрутке (`entities/website/lib/use-parallax-offset.ts`). */
  parallaxBackground: boolean;
  buttonLabel: string;
  buttonUrl: LinkTarget;
  secondaryLabel: string;
  secondaryUrl: LinkTarget;
}

function HeroRenderer({ props, pages }: BlockRendererProps<HeroProps>) {
  const hasImage = Boolean(props.backgroundImage);
  // Деструктурируется сразу, не хранится как единый объект `parallax.ref`/
  // `parallax.offsetY` — см. комментарий у аналогичного места в
  // `BlockRenderer.tsx` (React Compiler иначе тянет «это реф» на весь объект).
  const { ref: parallaxRef, offsetY: parallaxOffsetY } = useParallaxOffset(
    hasImage && props.parallaxBackground,
  );

  return (
    <div className={styles.hero} data-has-image={hasImage}>
      {hasImage && (
        <>
          {/* Разнесено на слои (фон / затемнение / контент), не единый
           * `backgroundImage`-шорткат с градиентом поверх — иначе параллаксу
           * нечего было бы двигать отдельно от текста. `inset: -15% 0` —
           * запас по вертикали, чтобы `translateY` при параллаксе не
           * обнажал край картинки. */}
          <div
            ref={parallaxRef}
            className={styles.hero__bg}
            style={{
              backgroundImage: `url(${props.backgroundImage})`,
              transform: parallaxOffsetY ? `translateY(${parallaxOffsetY}px)` : undefined,
            }}
          />
          {/* Тот же тёмный нейтральный оверлей, что и раньше (не цвет темы —
           * на ярких акцентах красил бы фото в сплошной цвет вместо лёгкого
           * затемнения под текст), теперь отдельным слоем, а не вторым
           * стопом того же `linear-gradient`. */}
          <div className={styles.hero__overlay} />
        </>
      )}
      <div className={styles.hero__content}>
        {props.eyebrow && <span className={styles.hero__eyebrow}>{props.eyebrow}</span>}
        <h1 className={styles.hero__heading}>{props.heading}</h1>
        {props.description && <p className={styles.hero__description}>{props.description}</p>}
        <div className={styles.hero__actions}>
          {props.buttonLabel && (
            <a
              href={resolveLinkHref(props.buttonUrl, pages)}
              className={styles['hero__button--primary']}
            >
              {props.buttonLabel}
            </a>
          )}
          {props.secondaryLabel && (
            <a
              href={resolveLinkHref(props.secondaryUrl, pages)}
              className={styles['hero__button--secondary']}
            >
              {props.secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const heroFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  { key: 'backgroundImage', label: 'Фоновое изображение', control: 'image' },
  {
    key: 'parallaxBackground',
    label: 'Параллакс фона (работает только с изображением)',
    control: 'toggle',
  },
  { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
  { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
  { key: 'secondaryLabel', label: 'Вторая кнопка — текст', control: 'text' },
  { key: 'secondaryUrl', label: 'Вторая кнопка — ссылка', control: 'link' },
];

registerBlock<HeroProps>({
  type: 'hero',
  label: 'Главный экран',
  category: 'business',
  icon: ImageIcon,
  description: 'Главный экран сайта — заголовок, текст и кнопка',
  defaultProps: {
    eyebrow: '',
    heading: 'Название вашего бизнеса',
    description: 'Короткое и цепляющее описание того, чем вы занимаетесь.',
    backgroundImage: null,
    parallaxBackground: false,
    buttonLabel: 'Связаться с нами',
    buttonUrl: { type: 'anchor', anchor: 'contact' },
    secondaryLabel: '',
    secondaryUrl: EMPTY_LINK_TARGET,
  },
  defaultStyle: { paddingY: 'xl', textAlign: 'center' },
  fields: heroFields,
  Renderer: HeroRenderer,
});

// --- About -------------------------------------------------------------

interface AboutProps {
  eyebrow: string;
  heading: string;
  text: string;
  image: string | null;
  /** По какую сторону фото — `'right'` сохраняет прежнее (единственное до
   * этого поля) поведение для уже существующих блоков. Несколько `about`-
   * блоков подряд с чередующимся `left`/`right` — «зигзаг»-паттерн
   * (фото-текст, текст-фото, фото-текст…), которым уже сам по себе
   * закрывается частый в лендингах приём, без отдельного нового блока. */
  imagePosition: 'left' | 'right';
}

function AboutRenderer({ props }: BlockRendererProps<AboutProps>) {
  return (
    <div
      className={cn(styles.about, props.imagePosition === 'left' && styles['about--image-left'])}
    >
      <div className={styles['about__body']}>
        {props.eyebrow && <span className={styles.hero__eyebrow}>{props.eyebrow}</span>}
        <h2 className={styles['about__heading']}>{props.heading}</h2>
        <p className={styles['about__text']}>{props.text}</p>
      </div>
      {props.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла
        <img src={props.image} alt="" className={styles['about__image']} />
      ) : (
        <div className={styles['about__image-placeholder']}>
          <ImageIcon />
        </div>
      )}
    </div>
  );
}

const aboutFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'text', label: 'Текст', control: 'textarea', rows: 5 },
  { key: 'image', label: 'Изображение', control: 'image' },
  {
    key: 'imagePosition',
    label: 'Фото',
    control: 'segmented',
    options: [
      { value: 'right', label: 'Справа' },
      { value: 'left', label: 'Слева' },
    ],
  },
];

registerBlock<AboutProps>({
  type: 'about',
  label: 'О нас',
  category: 'business',
  icon: MailIcon,
  description: 'Текст и фото рядом — расскажите о своём деле',
  defaultProps: {
    eyebrow: 'О нас',
    heading: 'Почему выбирают нас',
    text: 'Расскажите историю бизнеса, ваши ценности и то, что делает вас особенными.',
    image: null,
    imagePosition: 'right',
  },
  fields: aboutFields,
  Renderer: AboutRenderer,
});

// --- Services / ServiceCard ----------------------------------------------

interface ServicesProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: { icon: string; title: string; description: string }[];
  columns: number;
}

const repeatableIconFields = (itemLabel: string, max?: number): FieldSchema[] => [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'items',
    label: itemLabel,
    control: 'list',
    itemLabel,
    max,
    itemFields: [
      { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
      { key: 'title', label: 'Заголовок', control: 'text' },
      { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
    ],
  },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

function ServicesRenderer({ props }: BlockRendererProps<ServicesProps>) {
  return <RepeatableIconCards {...props} />;
}

registerBlock<ServicesProps>({
  type: 'services',
  label: 'Услуги',
  category: 'business',
  icon: ClockIcon,
  description: 'Список услуг с иконками',
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
  fields: repeatableIconFields('Услуга'),
  Renderer: ServicesRenderer,
});

interface ServiceCardProps {
  icon: string;
  title: string;
  description: string;
  price: string;
}

function ServiceCardRenderer({ props }: BlockRendererProps<ServiceCardProps>) {
  const Icon = resolveIconChoice(props.icon);
  return (
    <div className={styles['service-card']}>
      <span className={styles['service-card__icon']}>
        {/* eslint-disable-next-line react-hooks/static-components -- resolveIconChoice читает стабильную ссылку из статической карты (см. icon-choices.ts), не создаёт новый компонент на каждый рендер */}
        <Icon />
      </span>
      <h3 className={styles['service-card__title']}>{props.title}</h3>
      <p className={styles['service-card__description']}>{props.description}</p>
      {props.price && <span className={styles['service-card__price']}>{props.price}</span>}
    </div>
  );
}

registerBlock<ServiceCardProps>({
  type: 'servicecard',
  label: 'Карточка услуги',
  category: 'business',
  icon: ClockIcon,
  description: 'Одна услуга отдельной карточкой — для гибкой раскладки',
  defaultProps: {
    icon: 'star',
    title: 'Название услуги',
    description: 'Описание услуги.',
    price: '',
  },
  fields: [
    { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
    { key: 'title', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
    { key: 'price', label: 'Цена (необязательно)', control: 'text' },
  ],
  Renderer: ServiceCardRenderer,
});

// --- Pricing ---------------------------------------------------------------

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: { text: string }[];
  highlighted: boolean;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

interface PricingProps {
  eyebrow: string;
  heading: string;
  description: string;
  plans: PricingPlan[];
}

function PricingRenderer({ props, pages }: BlockRendererProps<PricingProps>) {
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
      />
      <div className={styles.pricing}>
        {props.plans.map((plan, index) => (
          <div
            key={index}
            className={styles['pricing-plan']}
            data-highlighted={plan.highlighted || undefined}
          >
            <span className={styles['pricing-plan__name']}>{plan.name}</span>
            <span className={styles['pricing-plan__price']}>
              {plan.price}
              {plan.period && (
                <span className={styles['pricing-plan__period']}>/{plan.period}</span>
              )}
            </span>
            <ul className={styles['pricing-plan__features']}>
              {plan.features.map((feature, featureIndex) => (
                <li key={featureIndex}>{feature.text}</li>
              ))}
            </ul>
            {plan.buttonLabel && (
              <a
                href={resolveLinkHref(plan.buttonUrl, pages)}
                className={styles['pricing-plan__button']}
              >
                {plan.buttonLabel}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** `plan.price` — свободный текст (владелец печатает «₴990» сам, как и
 * `plan.name`/`plan.period`), НЕ структурированное `{amountMinor, currency}`
 * — сознательно вне Currency System (ROADMAP.md §8): этот блок не привязан
 * ни к одному `Product`/`Service`, у него нет данных, которые Currency
 * System могла бы подставить, только дефолтный текст затравки ниже. Делать
 * его валютно-осознанным означало бы структурировать поле цены ради блока,
 * который сегодня не сеется ни одним шаблоном (`agency`/`local-business`/
 * `restaurant` его не используют) — то же "не строить впрок" рассуждение,
 * что и у остальных сознательно узких мест этого проекта. */
registerBlock<PricingProps>({
  type: 'pricing',
  label: 'Тарифы',
  category: 'business',
  icon: ClockIcon,
  description: 'Сравнение тарифов или пакетов услуг',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    {
      key: 'plans',
      label: 'Тарифы',
      control: 'list',
      itemLabel: 'Тариф',
      max: 4,
      itemFields: [
        { key: 'name', label: 'Название', control: 'text' },
        { key: 'price', label: 'Цена', control: 'text' },
        { key: 'period', label: 'Период (например, мес)', control: 'text' },
        {
          key: 'features',
          label: 'Пункты',
          control: 'list',
          itemLabel: 'Пункт',
          itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
        },
        { key: 'highlighted', label: 'Выделить тариф', control: 'toggle' },
        { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
        { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
      ],
    },
  ],
  Renderer: PricingRenderer,
});

// --- Team / TeamMember -----------------------------------------------------

interface TeamProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: { photo: string | null; name: string; role: string; text: string }[];
  columns: number;
}

const peopleFields = (itemLabel: string, variant: 'team' | 'quote' | 'review'): FieldSchema[] => [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  {
    key: 'items',
    label: itemLabel,
    control: 'list',
    itemLabel,
    itemFields: [
      { key: 'photo', label: 'Фото', control: 'image' },
      { key: 'name', label: 'Имя', control: 'text' },
      { key: 'role', label: variant === 'team' ? 'Должность' : 'Компания/роль', control: 'text' },
      {
        key: 'text',
        label: variant === 'team' ? 'Пару слов' : 'Текст отзыва',
        control: 'textarea',
        rows: 2,
      },
      ...(variant === 'review'
        ? ([
            { key: 'rating', label: 'Оценка (1–5)', control: 'number', min: 1, max: 5 },
          ] as FieldSchema[])
        : []),
    ],
  },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

function TeamRenderer({ props }: BlockRendererProps<TeamProps>) {
  return <RepeatablePeopleCards {...props} variant="team" />;
}

registerBlock<TeamProps>({
  type: 'team',
  label: 'Команда',
  category: 'business',
  icon: GlobeIcon,
  description: 'Фото и имена сотрудников',
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
  fields: peopleFields('Сотрудник', 'team'),
  Renderer: TeamRenderer,
});

interface TeamMemberProps {
  photo: string | null;
  name: string;
  role: string;
  text: string;
}

function TeamMemberRenderer({ props }: BlockRendererProps<TeamMemberProps>) {
  return (
    <div className={styles['team-member']}>
      {props.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла
        <img src={props.photo} alt="" className={styles['team-member__photo']} />
      ) : (
        <span className={styles['team-member__photo-placeholder']}>{props.name.slice(0, 1)}</span>
      )}
      <span className={styles['team-member__name']}>{props.name}</span>
      <span className={styles['team-member__role']}>{props.role}</span>
      {props.text && <p className={styles['team-member__text']}>{props.text}</p>}
    </div>
  );
}

registerBlock<TeamMemberProps>({
  type: 'teammember',
  label: 'Карточка сотрудника',
  category: 'business',
  icon: GlobeIcon,
  description: 'Один сотрудник отдельной карточкой',
  defaultProps: { photo: null, name: 'Имя Фамилия', role: 'Должность', text: '' },
  fields: [
    { key: 'photo', label: 'Фото', control: 'image' },
    { key: 'name', label: 'Имя', control: 'text' },
    { key: 'role', label: 'Должность', control: 'text' },
    { key: 'text', label: 'Пару слов', control: 'textarea', rows: 2 },
  ],
  Renderer: TeamMemberRenderer,
});

// --- Testimonials / Reviews --------------------------------------------

function TestimonialsRenderer({ props }: BlockRendererProps<TeamProps>) {
  return <RepeatablePeopleCards {...props} variant="quote" />;
}

registerBlock<TeamProps>({
  type: 'testimonials',
  label: 'Отзывы клиентов',
  category: 'business',
  icon: MailIcon,
  description: 'Цитаты довольных клиентов',
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
  fields: peopleFields('Отзыв', 'quote'),
  Renderer: TestimonialsRenderer,
});

interface ReviewsProps extends TeamProps {
  items: (TeamProps['items'][number] & { rating: number })[];
}

function ReviewsRenderer({ props }: BlockRendererProps<ReviewsProps>) {
  return <RepeatablePeopleCards {...props} variant="review" />;
}

registerBlock<ReviewsProps>({
  type: 'reviews',
  label: 'Оценки и отзывы',
  category: 'business',
  icon: MailIcon,
  description: 'Отзывы со звёздным рейтингом',
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
  fields: peopleFields('Отзыв', 'review'),
  Renderer: ReviewsRenderer,
});

// --- FAQ ---------------------------------------------------------------

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqProps {
  eyebrow: string;
  heading: string;
  items: FaqItem[];
}

function FaqRenderer({ props }: BlockRendererProps<FaqProps>) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={styles.block}>
      <SectionHeading eyebrow={props.eyebrow} heading={props.heading} align="left" />
      <div className={styles.faq}>
        {props.items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className={styles['faq-item']}>
              <button
                type="button"
                className={styles['faq-item__question']}
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                {item.question}
                <ChevronDownIcon
                  className={
                    isOpen ? styles['faq-item__chevron--open'] : styles['faq-item__chevron']
                  }
                />
              </button>
              {isOpen && <p className={styles['faq-item__answer']}>{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

registerBlock<FaqProps>({
  type: 'faq',
  label: 'Вопросы и ответы',
  category: 'business',
  icon: ChevronDownIcon,
  description: 'Раскрывающийся список частых вопросов',
  defaultProps: {
    eyebrow: 'FAQ',
    heading: 'Частые вопросы',
    items: [
      { question: 'Как записаться?', answer: 'Позвоните нам или заполните форму на сайте.' },
      { question: 'Какие способы оплаты?', answer: 'Принимаем карты и наличные.' },
    ],
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Вопросы',
      control: 'list',
      itemLabel: 'Вопрос',
      itemFields: [
        { key: 'question', label: 'Вопрос', control: 'text' },
        { key: 'answer', label: 'Ответ', control: 'textarea', rows: 2 },
      ],
    },
  ],
  Renderer: FaqRenderer,
});

// --- Contact -----------------------------------------------------------

interface ContactProps {
  eyebrow: string;
  heading: string;
  description: string;
}

function ContactRenderer({ props, business }: BlockRendererProps<ContactProps>) {
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
        align="left"
      />
      <div className={styles.contact}>
        {business.email && (
          <a href={`mailto:${business.email}`} className={styles['contact__row']}>
            <MailIcon />
            {business.email}
          </a>
        )}
        {business.phone && (
          <a href={`tel:${business.phone}`} className={styles['contact__row']}>
            <ClockIcon />
            {business.phone}
          </a>
        )}
        {business.address && (
          <span className={styles['contact__row']}>
            <LocationIcon />
            {business.address}
          </span>
        )}
      </div>
    </div>
  );
}

registerBlock<ContactProps>({
  type: 'contact',
  label: 'Контакты',
  category: 'business',
  icon: MailIcon,
  description: 'Email, телефон и адрес — подтягиваются из карточки бизнеса',
  defaultProps: { eyebrow: 'Контакты', heading: 'Свяжитесь с нами', description: '' },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Текст', control: 'textarea', rows: 2 },
  ],
  Renderer: ContactRenderer,
});

// --- Opening Hours -------------------------------------------------------

interface OpeningHoursRow {
  day: string;
  hours: string;
}

interface OpeningHoursProps {
  heading: string;
  rows: OpeningHoursRow[];
}

function OpeningHoursRenderer({ props }: BlockRendererProps<OpeningHoursProps>) {
  return (
    <div className={styles.block}>
      <SectionHeading heading={props.heading} align="left" />
      <dl className={styles.hours}>
        {props.rows.map((row, index) => (
          <div key={index} className={styles['hours__row']}>
            <dt>{row.day}</dt>
            <dd>{row.hours}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const DEFAULT_HOURS: OpeningHoursRow[] = [
  { day: 'Понедельник — пятница', hours: '9:00 – 19:00' },
  { day: 'Суббота', hours: '10:00 – 17:00' },
  { day: 'Воскресенье', hours: 'Выходной' },
];

registerBlock<OpeningHoursProps>({
  type: 'openinghours',
  label: 'Часы работы',
  category: 'business',
  icon: ClockIcon,
  description: 'Расписание работы по дням',
  defaultProps: { heading: 'Часы работы', rows: DEFAULT_HOURS },
  fields: [
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'rows',
      label: 'Дни',
      control: 'list',
      itemLabel: 'Строка',
      itemFields: [
        { key: 'day', label: 'День/дни', control: 'text' },
        { key: 'hours', label: 'Время', control: 'text' },
      ],
    },
  ],
  Renderer: OpeningHoursRenderer,
});

// --- Location ------------------------------------------------------------

interface LocationProps {
  heading: string;
  mapEmbedUrl: string;
}

function LocationRenderer({ props, business }: BlockRendererProps<LocationProps>) {
  return (
    <div className={styles.block}>
      <SectionHeading heading={props.heading} align="left" />
      {business.address && (
        <span className={styles['contact__row']}>
          <LocationIcon />
          {business.address}
        </span>
      )}
      {props.mapEmbedUrl && (
        <div className={styles['location__map']}>
          <iframe src={props.mapEmbedUrl} title="Карта" loading="lazy" />
        </div>
      )}
    </div>
  );
}

registerBlock<LocationProps>({
  type: 'location',
  label: 'Расположение',
  category: 'business',
  icon: LocationIcon,
  description: 'Адрес и карта',
  defaultProps: { heading: 'Где нас найти', mapEmbedUrl: '' },
  fields: [
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'mapEmbedUrl',
      label: 'Ссылка для встраивания карты',
      control: 'url',
      hint: 'Google Maps → Поделиться → Встроить карту → скопируйте ссылку из src',
    },
  ],
  Renderer: LocationRenderer,
});

// --- Social Links --------------------------------------------------------

function SocialLinksRenderer({ business }: BlockRendererProps<Record<string, never>>) {
  if (business.socialLinks.length === 0) return null;
  return (
    <div className={styles.social}>
      {business.socialLinks.map((link, index) => (
        <a
          key={index}
          href={link.url}
          className={styles['social__link']}
          target="_blank"
          rel="noopener noreferrer"
        >
          <GlobeIcon />
          {link.platform}
        </a>
      ))}
    </div>
  );
}

registerBlock<Record<string, never>>({
  type: 'sociallinks',
  label: 'Соцсети',
  category: 'business',
  icon: GlobeIcon,
  description: 'Ссылки на соцсети — подтягиваются из карточки бизнеса',
  defaultProps: {},
  fields: [],
  Renderer: SocialLinksRenderer,
});
