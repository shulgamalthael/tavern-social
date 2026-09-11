'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  ColumnsIcon,
  CopyIcon,
  GlobeIcon,
  GroupsIcon,
  ImageIcon,
  LocationIcon,
  MailIcon,
  MobileIcon,
  QuoteIcon,
  StarIcon,
  VideoIcon,
  WalletIcon,
} from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';
import { Popover } from '@/shared/ui/Popover';
import { useCarousel } from '../../lib/use-carousel';
import { useParallaxOffset } from '../../lib/use-parallax-offset';
import {
  registerBlock,
  type BlockBusinessContext,
  type BlockRendererProps,
  type FieldSchema,
} from '../../model/registry';
import { EMPTY_LINK_TARGET, resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget } from '../../model/types';
import { EditableText } from '../../ui/EditableText';
import { FormBlock, type FormFieldConfig } from '../shared/FormBlock';
import { RepeatableIconCards } from '../shared/RepeatableIconCards';
import { RepeatablePeopleCards, type PersonCardItem } from '../shared/RepeatablePeopleCards';
import { ICON_CHOICE_OPTIONS, resolveIconChoice } from '../shared/icon-choices';
import { patchListItem } from '../shared/patch-list-item';
import { SectionHeading } from '../shared/SectionHeading';
import { HeaderActions } from './HeaderActions';
import styles from './business.module.scss';
import primitives from '../shared/primitives.module.scss';

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

function HeroRenderer({ props, pages, isEditing, onEditProp }: BlockRendererProps<HeroProps>) {
  const editable = Boolean(isEditing && onEditProp);
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
        {(props.eyebrow || editable) && (
          <EditableText
            as="span"
            value={props.eyebrow}
            editable={editable}
            onCommit={(value) => onEditProp?.('eyebrow', value)}
            placeholder="Надпись сверху"
            className={styles.hero__eyebrow}
          />
        )}
        <EditableText
          as="h1"
          value={props.heading}
          editable={editable}
          onCommit={(value) => onEditProp?.('heading', value)}
          placeholder="Заголовок раздела"
          className={styles.hero__heading}
        />
        {(props.description || editable) && (
          <EditableText
            as="p"
            value={props.description}
            editable={editable}
            onCommit={(value) => onEditProp?.('description', value)}
            placeholder="Текст описания"
            className={styles.hero__description}
          />
        )}
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

// --- Hero video ----------------------------------------------------------
// Отдельный тип, не поле «фон-видео» у `hero` выше — у `hero` фон это
// `background-image` слой с параллаксом (`use-parallax-offset.ts`), для
// видео это была бы другая механика (`<video>`, без параллакса), плюс само
// поле «фон: картинка или видео» пришлось бы городить условным полем —
// проще и honest два отдельных типа, как и остальные пары в этой библиотеке
// (`imagecarousel`/`beforeaftertabs` и т. п.). Пустой `videoUrl` по
// умолчанию — тот же честный пустой дефолт, что у `hero.backgroundImage`
// и у `video.embedUrl` (`blocks/media/index.tsx`), не выдуманная ссылка.

interface HeroVideoProps {
  eyebrow: string;
  heading: string;
  description: string;
  videoUrl: string;
  posterImage: string | null;
  buttonLabel: string;
  buttonUrl: LinkTarget;
  secondaryLabel: string;
  secondaryUrl: LinkTarget;
}

function HeroVideoRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<HeroVideoProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles['hero-video']}>
      {props.videoUrl && (
        <video
          className={styles['hero-video__bg']}
          src={props.videoUrl}
          poster={props.posterImage || undefined}
          autoPlay
          muted
          loop
          playsInline
        />
      )}
      <div className={styles['hero-video__overlay']} />
      <div className={styles['hero-video__content']}>
        {(props.eyebrow || editable) && (
          <EditableText
            as="span"
            value={props.eyebrow}
            editable={editable}
            onCommit={(value) => onEditProp?.('eyebrow', value)}
            placeholder="Надпись сверху"
            className={styles['hero-video__eyebrow']}
          />
        )}
        <EditableText
          as="h1"
          value={props.heading}
          editable={editable}
          onCommit={(value) => onEditProp?.('heading', value)}
          placeholder="Заголовок раздела"
          className={styles['hero-video__heading']}
        />
        {(props.description || editable) && (
          <EditableText
            as="p"
            value={props.description}
            editable={editable}
            onCommit={(value) => onEditProp?.('description', value)}
            placeholder="Текст описания"
            className={styles['hero-video__description']}
          />
        )}
        <div className={styles['hero-video__actions']}>
          {props.buttonLabel && (
            <a
              href={resolveLinkHref(props.buttonUrl, pages)}
              className={styles['hero-video__button--primary']}
            >
              {props.buttonLabel}
            </a>
          )}
          {props.secondaryLabel && (
            <a
              href={resolveLinkHref(props.secondaryUrl, pages)}
              className={styles['hero-video__button--secondary']}
            >
              {props.secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

registerBlock<HeroVideoProps>({
  type: 'herovideo',
  label: 'Главный экран с видео',
  category: 'business',
  icon: VideoIcon,
  description: 'Главный экран с фоновым видео вместо картинки',
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
  defaultStyle: { paddingY: 'xl', textAlign: 'center' },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    {
      key: 'videoUrl',
      label: 'Ссылка на видео (.mp4)',
      control: 'url',
      hint: 'Прямая ссылка на видеофайл — проигрывается в фоне без звука, по кругу',
    },
    { key: 'posterImage', label: 'Заглушка, пока видео грузится', control: 'image' },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
    { key: 'secondaryLabel', label: 'Вторая кнопка — текст', control: 'text' },
    { key: 'secondaryUrl', label: 'Вторая кнопка — ссылка', control: 'link' },
  ],
  Renderer: HeroVideoRenderer,
});

// --- Hero with split form --------------------------------------------------
// Классический лендинговый приём (заголовок слева, форма захвата лида
// справа), которого сегодня можно достичь только вручную — `columns` +
// `heading`/`text` + `contactform` тремя отдельными блоками. Собранный в
// один тип, с реальной отправкой через тот же `FormBlock`, что и три
// формы в `blocks/forms/index.tsx` (не третья копия форм-движка).

interface HeroSplitFormProps {
  eyebrow: string;
  heading: string;
  description: string;
  formHeading: string;
  formDescription: string;
  fields: FormFieldConfig[];
  submitLabel: string;
  successMessage: string;
}

function HeroSplitFormRenderer({
  props,
  business,
  isEditing,
  onEditProp,
}: BlockRendererProps<HeroSplitFormProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles['hero-split-form']}>
      <div className={styles['hero-split-form__text']}>
        {(props.eyebrow || editable) && (
          <EditableText
            as="span"
            value={props.eyebrow}
            editable={editable}
            onCommit={(value) => onEditProp?.('eyebrow', value)}
            placeholder="Надпись сверху"
            className={styles['hero-split-form__eyebrow']}
          />
        )}
        <EditableText
          as="h2"
          value={props.heading}
          editable={editable}
          onCommit={(value) => onEditProp?.('heading', value)}
          placeholder="Заголовок раздела"
          className={styles['hero-split-form__heading']}
        />
        {(props.description || editable) && (
          <EditableText
            as="p"
            value={props.description}
            editable={editable}
            onCommit={(value) => onEditProp?.('description', value)}
            placeholder="Текст описания"
            className={styles['hero-split-form__description']}
          />
        )}
      </div>
      <div className={styles['hero-split-form__form']}>
        <FormBlock
          heading={props.formHeading}
          description={props.formDescription}
          fields={props.fields}
          submitLabel={props.submitLabel}
          successMessage={props.successMessage}
          formType="herosplitform"
          businessId={business.businessId}
          isEditing={isEditing}
          onEditHeading={(value) => onEditProp?.('formHeading', value)}
          onEditDescription={(value) => onEditProp?.('formDescription', value)}
        />
      </div>
    </div>
  );
}

registerBlock<HeroSplitFormProps>({
  type: 'herosplitform',
  label: 'Главный экран с формой',
  category: 'business',
  icon: MailIcon,
  description: 'Заголовок слева, форма заявки справа',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Текст', control: 'textarea', rows: 3 },
    { key: 'formHeading', label: 'Заголовок формы', control: 'text' },
    { key: 'formDescription', label: 'Текст под заголовком формы', control: 'textarea', rows: 2 },
    {
      key: 'fields',
      label: 'Поля формы',
      control: 'list',
      itemLabel: 'Поле',
      max: 6,
      itemFields: [
        { key: 'label', label: 'Подпись поля', control: 'text' },
        {
          key: 'type',
          label: 'Тип',
          control: 'select',
          options: [
            { value: 'text', label: 'Короткий текст' },
            { value: 'email', label: 'Email' },
            { value: 'textarea', label: 'Длинный текст' },
          ],
        },
      ],
    },
    { key: 'submitLabel', label: 'Текст кнопки отправки', control: 'text' },
    { key: 'successMessage', label: 'Сообщение после отправки', control: 'text' },
  ],
  Renderer: HeroSplitFormRenderer,
});

// --- Dual CTA (two audience paths) ----------------------------------------
// Не третий вариант `hero`/`herosplitform`/`herovideo` — эти три ведут к
// ОДНОЙ цели, здесь ровно наоборот: сайт с самого начала обслуживает две
// разные аудитории («для бизнеса» / «для частных лиц», «купить» / «стать
// партнёром» и т. п.), и решение приходится явно предложить посетителю, а
// не выбирать за него.

interface DualCtaPath {
  icon: string;
  eyebrow: string;
  heading: string;
  description: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

interface DualCtaProps {
  heading: string;
  paths: DualCtaPath[];
}

function DualCtaRenderer({ props, pages }: BlockRendererProps<DualCtaProps>) {
  return (
    <div className={styles.block}>
      {props.heading && <h2 className={styles['dual-cta__heading']}>{props.heading}</h2>}
      <div className={styles['dual-cta']}>
        {props.paths.map((path, index) => {
          const Icon = resolveIconChoice(path.icon);
          return (
            <div key={index} className={styles['dual-cta__path']}>
              <span className={styles['dual-cta__icon']}>
                <Icon />
              </span>
              {path.eyebrow && <span className={styles['dual-cta__eyebrow']}>{path.eyebrow}</span>}
              <h3 className={styles['dual-cta__path-heading']}>{path.heading}</h3>
              {path.description && (
                <p className={styles['dual-cta__description']}>{path.description}</p>
              )}
              {path.buttonLabel && (
                <a
                  href={resolveLinkHref(path.buttonUrl, pages)}
                  className={styles['dual-cta__button']}
                >
                  {path.buttonLabel}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

registerBlock<DualCtaProps>({
  type: 'dualcta',
  label: 'Два пути',
  category: 'business',
  icon: ColumnsIcon,
  description: 'Две параллельные карточки-приглашения для разных аудиторий',
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
  fields: [
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'paths',
      label: 'Пути',
      control: 'list',
      itemLabel: 'Путь',
      max: 2,
      itemFields: [
        { key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS },
        { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
        { key: 'heading', label: 'Заголовок', control: 'text' },
        { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
        { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
        { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
      ],
    },
  ],
  Renderer: DualCtaRenderer,
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

function AboutRenderer({ props, isEditing, onEditProp }: BlockRendererProps<AboutProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div
      className={cn(styles.about, props.imagePosition === 'left' && styles['about--image-left'])}
    >
      <div className={styles['about__body']}>
        {(props.eyebrow || editable) && (
          <EditableText
            as="span"
            value={props.eyebrow}
            editable={editable}
            onCommit={(value) => onEditProp?.('eyebrow', value)}
            placeholder="Надпись сверху"
            className={styles.hero__eyebrow}
          />
        )}
        <EditableText
          as="h2"
          value={props.heading}
          editable={editable}
          onCommit={(value) => onEditProp?.('heading', value)}
          placeholder="Заголовок раздела"
          className={styles['about__heading']}
        />
        <EditableText
          as="p"
          value={props.text}
          editable={editable}
          onCommit={(value) => onEditProp?.('text', value)}
          placeholder="Текст описания"
          className={styles['about__text']}
        />
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

function ServicesRenderer({ props, isEditing, onEditProp }: BlockRendererProps<ServicesProps>) {
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

function PricingRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<PricingProps>) {
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

// --- Pricing with monthly/yearly toggle -----------------------------------
// Отдельный тип, не поле-переключатель у `pricing` выше — у обычного тарифа
// одна свободная строка цены (`plan.price`), здесь их структурно две
// (`priceMonthly`/`priceYearly`) плюс собственное состояние переключателя
// (`useState`, `pages`/`business` тут ни при чём — чисто клиентское UI-
// состояние одного блока, по правилам Zustand-раздела `AGENTS.md` §4 не
// стору). Переиспользует CSS `pricing`/`pricing-plan*` у `pricing` выше —
// карточка тарифа выглядит одинаково, разница только в переключателе и
// структуре цены.

interface PricingTogglePlan {
  name: string;
  priceMonthly: string;
  priceYearly: string;
  features: { text: string }[];
  highlighted: boolean;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

interface PricingToggleProps {
  eyebrow: string;
  heading: string;
  description: string;
  monthlyLabel: string;
  yearlyLabel: string;
  yearlyHint: string;
  plans: PricingTogglePlan[];
}

function PricingToggleRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<PricingToggleProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [yearly, setYearly] = useState(false);

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
      <div className={styles['pricing-toggle__switch']}>
        <span
          className={
            !yearly
              ? styles['pricing-toggle__switch-label--active']
              : styles['pricing-toggle__switch-label']
          }
        >
          {props.monthlyLabel}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          aria-label="Переключить период тарифа"
          className={styles['pricing-toggle__switch-control']}
          onClick={() => setYearly((value) => !value)}
        >
          <span
            className={cn(
              styles['pricing-toggle__switch-thumb'],
              yearly && styles['pricing-toggle__switch-thumb--on'],
            )}
          />
        </button>
        <span
          className={
            yearly
              ? styles['pricing-toggle__switch-label--active']
              : styles['pricing-toggle__switch-label']
          }
        >
          {props.yearlyLabel}
          {props.yearlyHint && (
            <span className={styles['pricing-toggle__hint']}>{props.yearlyHint}</span>
          )}
        </span>
      </div>
      <div className={styles.pricing}>
        {props.plans.map((plan, index) => (
          <div
            key={index}
            className={styles['pricing-plan']}
            data-highlighted={plan.highlighted || undefined}
          >
            <span className={styles['pricing-plan__name']}>{plan.name}</span>
            <span className={styles['pricing-plan__price']}>
              {yearly ? plan.priceYearly : plan.priceMonthly}
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

registerBlock<PricingToggleProps>({
  type: 'pricingtoggle',
  label: 'Тарифы с переключателем',
  category: 'business',
  icon: WalletIcon,
  description: 'Тарифы с переключателем «помесячно / за год»',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    { key: 'monthlyLabel', label: 'Подпись «Помесячно»', control: 'text' },
    { key: 'yearlyLabel', label: 'Подпись «За год»', control: 'text' },
    { key: 'yearlyHint', label: 'Бейдж у годового периода (например, «-20%»)', control: 'text' },
    {
      key: 'plans',
      label: 'Тарифы',
      control: 'list',
      itemLabel: 'Тариф',
      max: 4,
      itemFields: [
        { key: 'name', label: 'Название', control: 'text' },
        { key: 'priceMonthly', label: 'Цена помесячно', control: 'text' },
        { key: 'priceYearly', label: 'Цена за год', control: 'text' },
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
  Renderer: PricingToggleRenderer,
});

// --- Pricing (single plan spotlight) --------------------------------------
// Не третий вариант оформления многоколоночной сетки, а другой сценарий
// целиком: у бизнеса ОДИН тариф/пакет, показывать его в виде «пустой» сетки
// из одной карточки было бы странно (сетка `.pricing` — `auto-fit`, одна
// карточка в ней растягивается на всю ширину). Переиспользует те же
// `.pricing-plan*` классы, что `pricing`/`pricingtoggle` выше, с
// собственным модификатором `--single` только для увеличенных отступов/
// центрирования по ширине секции.

interface PricingSingleProps {
  eyebrow: string;
  heading: string;
  description: string;
  name: string;
  price: string;
  period: string;
  features: { text: string }[];
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

function PricingSingleRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<PricingSingleProps>) {
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
      <div className={cn(styles['pricing-plan'], styles['pricing-plan--single'])} data-highlighted>
        <span className={styles['pricing-plan__name']}>{props.name}</span>
        <span className={styles['pricing-plan__price']}>
          {props.price}
          {props.period && <span className={styles['pricing-plan__period']}>/{props.period}</span>}
        </span>
        <ul className={styles['pricing-plan__features']}>
          {props.features.map((feature, index) => (
            <li key={index}>{feature.text}</li>
          ))}
        </ul>
        {props.buttonLabel && (
          <a
            href={resolveLinkHref(props.buttonUrl, pages)}
            className={styles['pricing-plan__button']}
          >
            {props.buttonLabel}
          </a>
        )}
      </div>
    </div>
  );
}

registerBlock<PricingSingleProps>({
  type: 'pricingsingle',
  label: 'Один тариф',
  category: 'business',
  icon: WalletIcon,
  description: 'Один выделенный тариф или пакет услуг по центру секции',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    { key: 'name', label: 'Название тарифа', control: 'text' },
    { key: 'price', label: 'Цена', control: 'text' },
    { key: 'period', label: 'Период (например, мес)', control: 'text' },
    {
      key: 'features',
      label: 'Пункты',
      control: 'list',
      itemLabel: 'Пункт',
      itemFields: [{ key: 'text', label: 'Текст', control: 'text' }],
    },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
  ],
  Renderer: PricingSingleRenderer,
});

// --- Pricing calculator ----------------------------------------------------
// Единственный виджет в этой библиотеке с настоящим `<input type="range">`
// и посчитанной на лету ценой — не третий вариант `pricing`/`pricingtoggle`
// (у тех цена — готовый текст на карточку), а честный калькулятор
// «базовая цена + цена за единицу × количество», понятный без бэкенда:
// `units` — обычный локальный `useState`, не сохраняется и не отправляется
// никуда, ровно то же самое клиентское UI-состояние, что и переключатель
// периода у `pricingtoggle` (`AGENTS.md` §4).

interface PricingCalculatorProps {
  eyebrow: string;
  heading: string;
  description: string;
  unitLabel: string;
  basePrice: number;
  pricePerUnit: number;
  minUnits: number;
  maxUnits: number;
  defaultUnits: number;
  currencySuffix: string;
  periodLabel: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

function PricingCalculatorRenderer({
  props,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<PricingCalculatorProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [units, setUnits] = useState(props.defaultUnits);
  const total = props.basePrice + props.pricePerUnit * units;

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
      <div className={styles['pricing-calc']}>
        <div className={styles['pricing-calc__slider-row']}>
          <input
            type="range"
            min={props.minUnits}
            max={props.maxUnits}
            value={units}
            onChange={(event) => setUnits(Number(event.target.value))}
            className={styles['pricing-calc__slider']}
            aria-label={props.unitLabel}
          />
          <span className={styles['pricing-calc__units']}>
            {units} {props.unitLabel}
          </span>
        </div>
        <div className={styles['pricing-calc__total']}>
          {total.toLocaleString('ru-RU')} {props.currencySuffix}
          {props.periodLabel && (
            <span className={styles['pricing-calc__period']}>/{props.periodLabel}</span>
          )}
        </div>
        {props.buttonLabel && (
          <a
            href={resolveLinkHref(props.buttonUrl, pages)}
            className={styles['pricing-calc__button']}
          >
            {props.buttonLabel}
          </a>
        )}
      </div>
    </div>
  );
}

registerBlock<PricingCalculatorProps>({
  type: 'pricingcalculator',
  label: 'Калькулятор цены',
  category: 'business',
  icon: WalletIcon,
  description: 'Ползунок «количество» пересчитывает итоговую цену на лету',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    { key: 'unitLabel', label: 'Название единицы (например, «пользователей»)', control: 'text' },
    { key: 'basePrice', label: 'Базовая цена', control: 'number', min: 0 },
    { key: 'pricePerUnit', label: 'Цена за единицу', control: 'number', min: 0 },
    { key: 'minUnits', label: 'Минимум', control: 'number', min: 0 },
    { key: 'maxUnits', label: 'Максимум', control: 'number', min: 1 },
    { key: 'defaultUnits', label: 'Значение по умолчанию', control: 'number', min: 0 },
    { key: 'currencySuffix', label: 'Валюта', control: 'text' },
    { key: 'periodLabel', label: 'Период (например, мес)', control: 'text' },
    { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
    { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
  ],
  Renderer: PricingCalculatorRenderer,
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

function TeamRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TeamProps>) {
  return (
    <RepeatablePeopleCards
      {...props}
      variant="team"
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

// --- Team with social links ----------------------------------------------
// Тот же движок `RepeatablePeopleCards`, что у `team` выше (`variant="team"`)
// — не форк, а то же самое расширение через опциональное поле, что уже
// применялось у `layout` в `testimonialwall` (партия виджетов №4):
// `socialLinks` добавлено в `PersonCardItem` как необязательное, `team`
// сам по себе ничего не меняет и не обязан знать об этом поле.

interface TeamSocialProps {
  eyebrow: string;
  heading: string;
  description: string;
  items: PersonCardItem[];
  columns: number;
}

function TeamSocialRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TeamSocialProps>) {
  return (
    <RepeatablePeopleCards
      {...props}
      variant="team"
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

registerBlock<TeamSocialProps>({
  type: 'teamsocial',
  label: 'Команда с соцсетями',
  category: 'business',
  icon: GlobeIcon,
  description: 'Фото, имена сотрудников и ссылки на их соцсети',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
    {
      key: 'items',
      label: 'Сотрудники',
      control: 'list',
      itemLabel: 'Сотрудник',
      itemFields: [
        { key: 'photo', label: 'Фото', control: 'image' },
        { key: 'name', label: 'Имя', control: 'text' },
        { key: 'role', label: 'Должность', control: 'text' },
        {
          key: 'socialLinks',
          label: 'Соцсети',
          control: 'list',
          itemLabel: 'Ссылка',
          max: 4,
          itemFields: [
            { key: 'platform', label: 'Платформа', control: 'text' },
            { key: 'url', label: 'Ссылка', control: 'url' },
          ],
        },
      ],
    },
    { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
  ],
  Renderer: TeamSocialRenderer,
});

// --- Testimonials / Reviews --------------------------------------------

function TestimonialsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TeamProps>) {
  return (
    <RepeatablePeopleCards
      {...props}
      variant="quote"
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

function ReviewsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<ReviewsProps>) {
  return (
    <RepeatablePeopleCards
      {...props}
      variant="review"
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

// --- Testimonial wall --------------------------------------------------
// Тот же движок `RepeatablePeopleCards`, что у `testimonials`/`reviews`
// выше (`variant="quote"`), но `layout="masonry"` — плотная витрина
// карточек разной высоты (CSS-колонки), не равномерная сетка. Дефолтные
// тексты сознательно разной длины, чтобы даже в превью библиотеки был
// виден сам эффект мозаики, а не ряд одинаковых прямоугольников.

function TestimonialWallRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TeamProps>) {
  return (
    <RepeatablePeopleCards
      {...props}
      variant="quote"
      layout="masonry"
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

registerBlock<TeamProps>({
  type: 'testimonialwall',
  label: 'Стена отзывов',
  category: 'business',
  icon: QuoteIcon,
  description: 'Плотная витрина отзывов мозаикой — карточки разной высоты',
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
  fields: peopleFields('Отзыв', 'quote'),
  Renderer: TestimonialWallRenderer,
});

// --- Rating summary ------------------------------------------------------
// Агрегат, не список — в отличие от `reviews` (полные карточки с текстом
// каждого отзыва), здесь только числа: средняя оценка + разбивка по
// звёздам. Как и `pricing.plan.price`, значения — свободно вписанные
// владельцем числа, не подсчитаны системой (на сайте пока нет структуры
// «оценка от реального посетителя», см. комментарий у `ReviewsRenderer`) —
// та же осознанная граница, что и у остальных подобных мест проекта.
// Звёзды переиспользуют `primitives['people-card__star(--filled)']`, те же
// классы, что у `reviews`/`testimonialsslider` — тот же визуальный язык
// звёздного рейтинга по всему сайту, не третий похожий набор CSS.

interface RatingBreakdownRow {
  stars: number;
  percent: number;
}

interface RatingSummaryProps {
  eyebrow: string;
  heading: string;
  averageRating: number;
  totalReviews: number;
  breakdown: RatingBreakdownRow[];
}

function RatingSummaryRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<RatingSummaryProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const rounded = Math.round(props.averageRating);

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['rating-summary']}>
        <div className={styles['rating-summary__score']}>
          <span className={styles['rating-summary__number']}>{props.averageRating.toFixed(1)}</span>
          <div
            className={primitives['people-card__rating']}
            aria-label={`Оценка ${props.averageRating} из 5`}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <StarIcon
                key={index}
                className={
                  index < rounded
                    ? primitives['people-card__star--filled']
                    : primitives['people-card__star']
                }
              />
            ))}
          </div>
          <span className={styles['rating-summary__count']}>{props.totalReviews} отзывов</span>
        </div>
        <div className={styles['rating-summary__breakdown']}>
          {props.breakdown.map((row, index) => (
            <div key={index} className={styles['rating-summary__row']}>
              <span className={styles['rating-summary__row-label']}>{row.stars} ★</span>
              <span className={styles['rating-summary__bar-track']}>
                <span
                  className={styles['rating-summary__bar-fill']}
                  style={{ width: `${row.percent}%` }}
                />
              </span>
              <span className={styles['rating-summary__row-percent']}>{row.percent}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

registerBlock<RatingSummaryProps>({
  type: 'ratingsummary',
  label: 'Сводка оценок',
  category: 'business',
  icon: StarIcon,
  description: 'Средняя оценка и разбивка по звёздам',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'averageRating',
      label: 'Средняя оценка (0–5)',
      control: 'number',
      min: 0,
      max: 5,
      step: 0.1,
    },
    { key: 'totalReviews', label: 'Всего отзывов', control: 'number', min: 0 },
    {
      key: 'breakdown',
      label: 'Разбивка по звёздам',
      control: 'list',
      itemLabel: 'Строка',
      max: 5,
      itemFields: [
        { key: 'stars', label: 'Звёзд', control: 'number', min: 1, max: 5 },
        { key: 'percent', label: 'Процент, %', control: 'number', min: 0, max: 100 },
      ],
    },
  ],
  Renderer: RatingSummaryRenderer,
});

// --- Platform ratings ------------------------------------------------------
// Не третий вариант `ratingsummary` — тот раскладывает ОДНУ оценку по
// звёздам, здесь несколько РАЗНЫХ площадок (Google/Facebook/Trustpilot и
// т. п.) рядом, каждая со своим числом. Значения — свободный текст/числа,
// вписанные владельцем (та же честная граница, что у `ratingsummary` и
// `pricing.plan.price`), не подключение к реальным API отзывов.

interface PlatformRatingItem {
  platform: string;
  rating: number;
  count: number;
}

interface PlatformRatingsProps {
  eyebrow: string;
  heading: string;
  items: PlatformRatingItem[];
}

function PlatformRatingsRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<PlatformRatingsProps>) {
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
      <div className={styles['platform-ratings']}>
        {props.items.map((item, index) => (
          <div key={index} className={styles['platform-ratings__item']}>
            <span className={styles['platform-ratings__platform']}>{item.platform}</span>
            <span className={styles['platform-ratings__score']}>
              <StarIcon className={primitives['people-card__star--filled']} />
              {item.rating.toFixed(1)}
            </span>
            <span className={styles['platform-ratings__count']}>{item.count} отзывов</span>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<PlatformRatingsProps>({
  type: 'platformratings',
  label: 'Оценки по площадкам',
  category: 'business',
  icon: StarIcon,
  description: 'Оценки бизнеса на разных площадках (Google, Facebook и т. п.) рядом',
  defaultProps: {
    eyebrow: '',
    heading: 'Нас оценивают',
    items: [
      { platform: 'Google', rating: 4.8, count: 230 },
      { platform: 'Facebook', rating: 4.9, count: 150 },
    ],
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Площадки',
      control: 'list',
      itemLabel: 'Площадка',
      max: 6,
      itemFields: [
        { key: 'platform', label: 'Название площадки', control: 'text' },
        { key: 'rating', label: 'Оценка (0–5)', control: 'number', min: 0, max: 5, step: 0.1 },
        { key: 'count', label: 'Число отзывов', control: 'number', min: 0 },
      ],
    },
  ],
  Renderer: PlatformRatingsRenderer,
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

function FaqRenderer({ props, isEditing, onEditProp }: BlockRendererProps<FaqProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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

// --- FAQ with category tabs ------------------------------------------------
// Композиция двух уже существующих движков этого файла, не новый с нуля:
// строка вкладок (тот же принцип, что `TabsBlock` в `blocks/content/
// index.tsx`, но не импортируется оттуда — стили категории `business` не
// должны зависеть от стилей категории `content`, у каждой свой модуль) +
// тот же аккордеон, что у `FaqRenderer` выше, переиспользующий его
// `.faq`/`.faq-item*` CSS-классы напрямую (тот же файл). Переключение
// вкладки сбрасывает `openIndex` на первый вопрос — иначе открытый вопрос
// №3 в одной категории мог бы оказаться «открытым» вопросом №3 в другой,
// не имеющим с ним ничего общего.

interface FaqTabCategory {
  label: string;
  items: FaqItem[];
}

interface FaqTabsProps {
  eyebrow: string;
  heading: string;
  categories: FaqTabCategory[];
}

function FaqTabsRenderer({ props, isEditing, onEditProp }: BlockRendererProps<FaqTabsProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [activeTab, setActiveTab] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const active = props.categories[activeTab];

  function selectTab(index: number) {
    setActiveTab(index);
    setOpenIndex(0);
  }

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
      <div className={styles['faq-tabs__list']} role="tablist">
        {props.categories.map((category, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={index === activeTab}
            className={cn(
              styles['faq-tabs__tab'],
              index === activeTab && styles['faq-tabs__tab--active'],
            )}
            onClick={() => selectTab(index)}
          >
            {category.label}
          </button>
        ))}
      </div>
      {active && (
        <div className={styles.faq}>
          {active.items.map((item, index) => {
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
      )}
    </div>
  );
}

registerBlock<FaqTabsProps>({
  type: 'faqtabs',
  label: 'Вопросы по категориям',
  category: 'business',
  icon: ChevronDownIcon,
  description: 'FAQ, сгруппированные по вкладкам-категориям',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'categories',
      label: 'Категории',
      control: 'list',
      itemLabel: 'Категория',
      max: 6,
      itemFields: [
        { key: 'label', label: 'Название вкладки', control: 'text' },
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
    },
  ],
  Renderer: FaqTabsRenderer,
});

// --- Accordion list ------------------------------------------------------
// Тот же аккордеон, что у `FaqRenderer` выше — переиспользует его `.faq`/
// `.faq-item*` CSS-классы напрямую (тот же файл, тот же визуальный движок),
// только без Q&A-рамки: поля называются «Заголовок»/«Текст», не «Вопрос»/
// «Ответ» — для произвольного схлопывающегося контента (состав меню,
// характеристики товара и т. п.), не обязательно вопросов.

interface AccordionItem {
  title: string;
  content: string;
}

interface AccordionListProps {
  eyebrow: string;
  heading: string;
  items: AccordionItem[];
}

function AccordionListRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<AccordionListProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
                {item.title}
                <ChevronDownIcon
                  className={
                    isOpen ? styles['faq-item__chevron--open'] : styles['faq-item__chevron']
                  }
                />
              </button>
              {isOpen && <p className={styles['faq-item__answer']}>{item.content}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

registerBlock<AccordionListProps>({
  type: 'accordionlist',
  label: 'Аккордеон',
  category: 'business',
  icon: ChevronDownIcon,
  description: 'Схлопывающийся список произвольных разделов — не только вопросы и ответы',
  defaultProps: {
    eyebrow: '',
    heading: 'Что входит',
    items: [
      { title: 'Состав набора', content: 'Опишите, что именно входит в этот раздел.' },
      { title: 'Материалы', content: 'Расскажите про материалы или технологию.' },
      { title: 'Уход', content: 'Дайте рекомендации по уходу или использованию.' },
    ],
  },
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Разделы',
      control: 'list',
      itemLabel: 'Раздел',
      itemFields: [
        { key: 'title', label: 'Заголовок', control: 'text' },
        { key: 'content', label: 'Текст', control: 'textarea', rows: 3 },
      ],
    },
  ],
  Renderer: AccordionListRenderer,
});

// --- FAQ search ----------------------------------------------------------
// Тот же аккордеон (`.faq`/`.faq-item*`, объявлен у `FaqRenderer` выше), с
// добавленным текстовым фильтром — простое подстроковое совпадение по
// вопросу и ответу на клиенте, тот же приём, что уже проверен в
// `entitysearch` (`blocks/navigation/index.tsx`), не новая логика поиска.

interface FaqSearchProps {
  eyebrow: string;
  heading: string;
  placeholder: string;
  emptyText: string;
  items: FaqItem[];
}

function FaqSearchRenderer({ props, isEditing, onEditProp }: BlockRendererProps<FaqSearchProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? props.items.filter(
        (item) =>
          item.question.toLowerCase().includes(trimmed) ||
          item.answer.toLowerCase().includes(trimmed),
      )
    : props.items;

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
      <input
        type="search"
        className={styles['faq-search__input']}
        placeholder={props.placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpenIndex(0);
        }}
      />
      {filtered.length === 0 ? (
        <p className={styles['faq-search__empty']}>{props.emptyText}</p>
      ) : (
        <div className={styles.faq}>
          {filtered.map((item, index) => {
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
      )}
    </div>
  );
}

registerBlock<FaqSearchProps>({
  type: 'faqsearch',
  label: 'Вопросы с поиском',
  category: 'business',
  icon: ChevronDownIcon,
  description: 'FAQ с полем поиска — фильтрует вопросы и ответы по подстроке',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'placeholder', label: 'Подсказка в поле поиска', control: 'text' },
    { key: 'emptyText', label: 'Текст, если ничего не найдено', control: 'text' },
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
  Renderer: FaqSearchRenderer,
});

// --- Contact -----------------------------------------------------------

interface ContactProps {
  eyebrow: string;
  heading: string;
  description: string;
}

function ContactRenderer({
  props,
  business,
  isEditing,
  onEditProp,
}: BlockRendererProps<ContactProps>) {
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

function OpeningHoursRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<OpeningHoursProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        heading={props.heading}
        align="left"
        editable={editable}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
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

// --- Business hours (live open/closed badge) ------------------------------
// НЕ то же самое, что `openinghours` выше — тот показывает произвольный
// текст, вписанный владельцем вручную (гибко, но статично). Этот блок
// считает «открыто сейчас» от РЕАЛЬНОГО `Business.workingHours`
// (структурированные часы по дням, которые уже питают настоящий расчёт
// доступности бронирования, см. `AppointmentsService`) — впервые
// прокинутого до рендерера блоков в этой партии виджетов (см. комментарий
// `BlockBusinessContext.workingHours`, `model/registry.ts`): раньше
// `PublicSiteWidget`/анонимный публичный DTO вообще не отдавали контакты
// бизнеса настоящему посетителю сайта — реальный баг, найденный и
// исправленный при проектировании именно этого блока.
//
// «Сейчас» — `new Date()`, не читается синхронно в теле эффекта
// (`react-hooks/set-state-in-effect`) — первое вычисление в колбэке
// `queueMicrotask`, дальше пересчитывается раз в минуту.

interface BusinessHoursProps {
  openLabel: string;
  closedLabel: string;
  unknownLabel: string;
  showHours: boolean;
}

type BusinessHoursStatus = { state: 'open' | 'closed' | 'unknown'; hours: string | null };

const WEEKDAY_BY_JS_DAY: ('sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat')[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

function computeBusinessHoursStatus(
  workingHours: BlockBusinessContext['workingHours'],
  now: Date,
): BusinessHoursStatus {
  if (!workingHours || Object.keys(workingHours).length === 0) {
    return { state: 'unknown', hours: null };
  }
  const today = workingHours[WEEKDAY_BY_JS_DAY[now.getDay()]];
  if (!today) return { state: 'closed', hours: null };

  const [openH, openM] = today.open.split(':').map(Number);
  const [closeH, closeM] = today.close.split(':').map(Number);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const isOpen = minutesNow >= openH * 60 + openM && minutesNow < closeH * 60 + closeM;

  return { state: isOpen ? 'open' : 'closed', hours: `${today.open}–${today.close}` };
}

function BusinessHoursRenderer({ props, business }: BlockRendererProps<BusinessHoursProps>) {
  const [status, setStatus] = useState<BusinessHoursStatus | null>(null);

  useEffect(() => {
    function tick() {
      setStatus(computeBusinessHoursStatus(business.workingHours, new Date()));
    }
    queueMicrotask(tick);
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [business.workingHours]);

  if (!status) return null;

  const label =
    status.state === 'open'
      ? props.openLabel
      : status.state === 'closed'
        ? props.closedLabel
        : props.unknownLabel;

  return (
    <div className={styles['business-hours']}>
      <span
        className={cn(
          styles['business-hours__dot'],
          styles[`business-hours__dot--${status.state}`],
        )}
      />
      <span className={styles['business-hours__label']}>{label}</span>
      {props.showHours && status.hours && (
        <span className={styles['business-hours__hours']}>{status.hours}</span>
      )}
    </div>
  );
}

registerBlock<BusinessHoursProps>({
  type: 'businesshours',
  label: 'Статус «Открыто/Закрыто»',
  category: 'business',
  icon: ClockIcon,
  description: 'Живой значок по реальным часам работы бизнеса — обновляется в реальном времени',
  defaultProps: {
    openLabel: 'Открыто сейчас',
    closedLabel: 'Сейчас закрыто',
    unknownLabel: 'Часы работы не указаны',
    showHours: true,
  },
  fields: [
    { key: 'openLabel', label: 'Текст «Открыто»', control: 'text' },
    { key: 'closedLabel', label: 'Текст «Закрыто»', control: 'text' },
    { key: 'unknownLabel', label: 'Текст, если часы не заданы', control: 'text' },
    { key: 'showHours', label: 'Показывать часы на сегодня', control: 'toggle' },
  ],
  Renderer: BusinessHoursRenderer,
});

// --- Location ------------------------------------------------------------

interface LocationProps {
  heading: string;
  mapEmbedUrl: string;
}

function LocationRenderer({
  props,
  business,
  isEditing,
  onEditProp,
}: BlockRendererProps<LocationProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <div className={styles.block}>
      <SectionHeading
        heading={props.heading}
        align="left"
        editable={editable}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
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

// --- Locations list --------------------------------------------------------
// Для бизнеса с несколькими филиалами — не карта с несколькими метками (это
// потребовало бы Maps JavaScript API и отдельного API-ключа, которого у
// проекта нет — статичный embed-iframe у `location` умеет только ОДИН
// адрес), а честный список карточек филиалов: имя/адрес/телефон/часы,
// каждый пункт — обычный текст, без встроенной карты.

interface LocationEntry {
  name: string;
  address: string;
  phone: string;
  hours: string;
}

interface LocationsListProps {
  eyebrow: string;
  heading: string;
  locations: LocationEntry[];
}

function LocationsListRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<LocationsListProps>) {
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
      <div className={styles['locations-list']}>
        {props.locations.map((location, index) => (
          <div key={index} className={styles['locations-list__item']}>
            <span className={styles['locations-list__name']}>{location.name}</span>
            {location.address && (
              <span className={styles['locations-list__row']}>
                <LocationIcon />
                {location.address}
              </span>
            )}
            {location.phone && (
              <a href={`tel:${location.phone}`} className={styles['locations-list__row']}>
                <MobileIcon />
                {location.phone}
              </a>
            )}
            {location.hours && (
              <span className={styles['locations-list__row']}>
                <ClockIcon />
                {location.hours}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock<LocationsListProps>({
  type: 'locationslist',
  label: 'Список филиалов',
  category: 'business',
  icon: LocationIcon,
  description: 'Несколько адресов бизнеса — название, адрес, телефон, часы',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'locations',
      label: 'Филиалы',
      control: 'list',
      itemLabel: 'Филиал',
      itemFields: [
        { key: 'name', label: 'Название', control: 'text' },
        { key: 'address', label: 'Адрес', control: 'text' },
        { key: 'phone', label: 'Телефон', control: 'text' },
        { key: 'hours', label: 'Часы работы', control: 'text' },
      ],
    },
  ],
  Renderer: LocationsListRenderer,
});

// --- Get directions --------------------------------------------------------
// Реальная ссылка на маршрут, построенная из `business.address` — та же
// идея, что и «добавить в календарь» у `eventcountdown` (`blocks/content/
// index.tsx`): чистая, детерминированная функция от уже имеющихся данных,
// без нового поля конфигурации и без embed-URL, который `location` просит
// вписать вручную.

interface GetDirectionsProps {
  buttonLabel: string;
}

function GetDirectionsRenderer({ props, business }: BlockRendererProps<GetDirectionsProps>) {
  if (!business.address) {
    return (
      <div className={styles['get-directions']}>
        <LocationIcon />
        <span className={styles['get-directions__address']}>
          Укажите адрес в карточке бизнеса, чтобы показать кнопку маршрута
        </span>
      </div>
    );
  }

  const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.address)}`;

  return (
    <div className={styles['get-directions']}>
      <LocationIcon />
      <span className={styles['get-directions__address']}>{business.address}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={styles['get-directions__button']}
      >
        {props.buttonLabel}
      </a>
    </div>
  );
}

registerBlock<GetDirectionsProps>({
  type: 'getdirections',
  label: 'Проложить маршрут',
  category: 'business',
  icon: LocationIcon,
  description: 'Адрес бизнеса и кнопка «Проложить маршрут» в Google Maps',
  defaultProps: { buttonLabel: 'Проложить маршрут' },
  fields: [{ key: 'buttonLabel', label: 'Текст кнопки', control: 'text' }],
  Renderer: GetDirectionsRenderer,
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

// --- Social share --------------------------------------------------------
// НЕ то же самое, что `sociallinks` выше — та ссылается на СОБСТВЕННЫЕ
// профили бизнеса (подтягивается из карточки бизнеса, без полей вообще),
// этот блок делится ТЕКУЩЕЙ страницей сайта в чужих соцсетях/по ссылке.
// `window.location.href` — то же самое чтение `window` внутри эффекта, что
// у `StickyBarRenderer`/`CookieBarRenderer` (`blocks/content/index.tsx`) —
// значение по умолчанию (`''`) обязано совпасть с тем, что уже отрисовал
// сервер, поэтому читается только после монтирования, в колбэке
// `queueMicrotask`, не синхронно в теле эффекта. В билдере (`isEditing`)
// клики по кнопкам-ссылкам ничего не открывают — та же причина, что у
// `FormBlock`'s «форма не должна реально отправляться, пока её
// редактируют»: `window.location.href` внутри билдера — это адрес самого
// билдера, не адрес будущей публичной страницы, ссылка была бы бессмысленной.

interface SocialShareProps {
  heading: string;
  showFacebook: boolean;
  showTwitter: boolean;
  showLinkedin: boolean;
  showTelegram: boolean;
  showCopyLink: boolean;
}

function SocialShareRenderer({ props, isEditing }: BlockRendererProps<SocialShareProps>) {
  const [pageUrl, setPageUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setPageUrl(window.location.href));
  }, []);

  const encodedUrl = encodeURIComponent(pageUrl);

  function shareHref(base: string) {
    return isEditing ? undefined : base;
  }

  function handleShareClick(event: MouseEvent) {
    if (isEditing) event.preventDefault();
  }

  async function handleCopy() {
    if (isEditing) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен (нет разрешения/не HTTPS-контекст) — просто
      // ничего не делаем, честное вырождение, как и у остальных мест
      // проекта, читающих/пишущих в браузерные API, которые могут отказать.
    }
  }

  return (
    <div className={styles['social-share']}>
      {props.heading && <span className={styles['social-share__heading']}>{props.heading}</span>}
      <div className={styles['social-share__buttons']}>
        {props.showFacebook && (
          <a
            href={shareHref(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['social-share__button']}
            onClick={handleShareClick}
          >
            <GlobeIcon />
            Facebook
          </a>
        )}
        {props.showTwitter && (
          <a
            href={shareHref(`https://twitter.com/intent/tweet?url=${encodedUrl}`)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['social-share__button']}
            onClick={handleShareClick}
          >
            <GlobeIcon />X (Twitter)
          </a>
        )}
        {props.showLinkedin && (
          <a
            href={shareHref(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['social-share__button']}
            onClick={handleShareClick}
          >
            <GlobeIcon />
            LinkedIn
          </a>
        )}
        {props.showTelegram && (
          <a
            href={shareHref(`https://t.me/share/url?url=${encodedUrl}`)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles['social-share__button']}
            onClick={handleShareClick}
          >
            <GlobeIcon />
            Telegram
          </a>
        )}
        {props.showCopyLink && (
          <button type="button" className={styles['social-share__button']} onClick={handleCopy}>
            <CopyIcon />
            {copied ? 'Скопировано!' : 'Скопировать ссылку'}
          </button>
        )}
      </div>
    </div>
  );
}

registerBlock<SocialShareProps>({
  type: 'socialshare',
  label: 'Поделиться страницей',
  category: 'business',
  icon: GlobeIcon,
  description: 'Кнопки «поделиться» текущей страницей в соцсетях и копирование ссылки',
  defaultProps: {
    heading: 'Поделитесь этой страницей',
    showFacebook: true,
    showTwitter: true,
    showLinkedin: false,
    showTelegram: true,
    showCopyLink: true,
  },
  fields: [
    { key: 'heading', label: 'Заголовок', control: 'text' },
    { key: 'showFacebook', label: 'Facebook', control: 'toggle' },
    { key: 'showTwitter', label: 'X (Twitter)', control: 'toggle' },
    { key: 'showLinkedin', label: 'LinkedIn', control: 'toggle' },
    { key: 'showTelegram', label: 'Telegram', control: 'toggle' },
    { key: 'showCopyLink', label: 'Копировать ссылку', control: 'toggle' },
  ],
  Renderer: SocialShareRenderer,
});

// --- Native share button -------------------------------------------------
// Не то же самое, что `socialshare` выше — та рисует ряд конкретных
// платформ, эта — одна кнопка, вызывающая системный шаринг ОС
// (`navigator.share`, реальный нативный лист «Поделиться» на телефоне),
// с честным откатом на копирование ссылки там, где `navigator.share`
// недоступен (обычно десктоп-браузеры).

interface NativeShareButtonProps {
  label: string;
  shareTitle: string;
  shareText: string;
}

function NativeShareButtonRenderer({
  props,
  isEditing,
}: BlockRendererProps<NativeShareButtonProps>) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (isEditing) return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: props.shareTitle || document.title,
          text: props.shareText,
          url,
        });
      } catch {
        // Посетитель закрыл системный лист «Поделиться» — не ошибка, ничего не делаем.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен — см. `SocialShareRenderer` выше.
    }
  }

  return (
    <button type="button" className={styles['native-share']} onClick={handleClick}>
      <GlobeIcon />
      {copied ? 'Ссылка скопирована!' : props.label}
    </button>
  );
}

registerBlock<NativeShareButtonProps>({
  type: 'nativesharebutton',
  label: 'Кнопка «Поделиться» (системная)',
  category: 'business',
  icon: GlobeIcon,
  description: 'Одна кнопка, открывающая системный лист «Поделиться» устройства',
  defaultProps: { label: 'Поделиться', shareTitle: '', shareText: '' },
  fields: [
    { key: 'label', label: 'Текст кнопки', control: 'text' },
    { key: 'shareTitle', label: 'Заголовок для шаринга (необязательно)', control: 'text' },
    { key: 'shareText', label: 'Текст для шаринга (необязательно)', control: 'text' },
  ],
  Renderer: NativeShareButtonRenderer,
});

// --- Testimonials slider -----------------------------------------------
// Один отзыв за раз, крупно — в отличие от `testimonials` (сетка карточек,
// см. выше), это витрина для случая «покажи один самый убедительный отзыв
// целиком», не обзор всех сразу. Переиспользует классы рейтинга/аватара из
// `primitives.module.scss` (те же, что у `RepeatablePeopleCards`), чтобы
// звёзды и заглушка-аватар выглядели одинаково во всех блоках отзывов на
// сайте, не как отдельный дизайн. Смена слайда/автопрокрутка — общий
// `useCarousel` (`../../lib/use-carousel.ts`), тот же движок, что у
// `imagecarousel`/`imagecarouselthumbs` (`blocks/media`).

interface TestimonialSlide {
  photo: string | null;
  name: string;
  role: string;
  text: string;
  rating: number;
}

interface TestimonialsSliderProps {
  eyebrow: string;
  heading: string;
  items: TestimonialSlide[];
  autoPlay: boolean;
  interval: number;
}

function TestimonialsSliderRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<TestimonialsSliderProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const { active, goTo, next, prev } = useCarousel(
    props.items.length,
    props.autoPlay,
    props.interval,
  );
  const current = props.items[active] ?? props.items[0];

  if (!current) return null;

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['testimonial-slide']}>
        {current.rating > 0 && (
          <div
            className={primitives['people-card__rating']}
            aria-label={`Оценка ${current.rating} из 5`}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <StarIcon
                key={index}
                className={
                  index < current.rating
                    ? primitives['people-card__star--filled']
                    : primitives['people-card__star']
                }
              />
            ))}
          </div>
        )}
        <p className={styles['testimonial-slide__text']}>{current.text}</p>
        <div className={primitives['people-card__byline']}>
          {current.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото
            <img src={current.photo} alt="" className={primitives['people-card__avatar']} />
          ) : (
            <span className={primitives['people-card__avatar-placeholder']}>
              {current.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className={primitives['people-card__byline-text']}>
            <span className={primitives['people-card__name']}>{current.name}</span>
            {current.role && (
              <span className={primitives['people-card__role']}>{current.role}</span>
            )}
          </div>
        </div>
        {props.items.length > 1 && (
          <div className={styles['testimonial-slide__nav']}>
            <button
              type="button"
              className={styles['testimonial-slide__arrow']}
              aria-label="Предыдущий отзыв"
              onClick={prev}
            >
              <ChevronRightIcon className={styles['testimonial-slide__arrow-icon--prev']} />
            </button>
            <div className={styles['testimonial-slide__dots']} role="tablist">
              {props.items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Отзыв ${index + 1}`}
                  className={cn(
                    styles['testimonial-slide__dot'],
                    index === active && styles['testimonial-slide__dot--active'],
                  )}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles['testimonial-slide__arrow']}
              aria-label="Следующий отзыв"
              onClick={next}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

registerBlock<TestimonialsSliderProps>({
  type: 'testimonialsslider',
  label: 'Отзывы (слайдер)',
  category: 'business',
  icon: StarIcon,
  description: 'Отзывы клиентов по одному с автопрокруткой',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Отзывы',
      control: 'list',
      itemLabel: 'Отзыв',
      max: 10,
      itemFields: [
        { key: 'photo', label: 'Фото', control: 'image' },
        { key: 'name', label: 'Имя', control: 'text' },
        { key: 'role', label: 'Кто это', control: 'text' },
        { key: 'text', label: 'Текст отзыва', control: 'textarea', rows: 3 },
        { key: 'rating', label: 'Оценка (0-5)', control: 'number', min: 0, max: 5 },
      ],
    },
    { key: 'autoPlay', label: 'Автопрокрутка', control: 'toggle' },
    { key: 'interval', label: 'Интервал автопрокрутки (сек)', control: 'number', min: 2, max: 15 },
  ],
  Renderer: TestimonialsSliderRenderer,
});

// --- Team slider -----------------------------------------------------------
// Не третий вариант `team`/`teamsocial` (сетка) — здесь один человек за раз,
// крупно, тем же самым движком навигации (`useCarousel`, `.testimonial-
// slide__nav`), что и `testimonialsslider` выше — переиспользует готовую
// карусель, не отдельный компонент карточки для одного сотрудника.

interface TeamSlide {
  photo: string | null;
  name: string;
  role: string;
  bio: string;
}

interface TeamSliderProps {
  eyebrow: string;
  heading: string;
  items: TeamSlide[];
  autoPlay: boolean;
  interval: number;
}

function TeamSliderRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TeamSliderProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const { active, goTo, next, prev } = useCarousel(
    props.items.length,
    props.autoPlay,
    props.interval,
  );
  const current = props.items[active] ?? props.items[0];

  if (!current) return null;

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['team-slide']}>
        {current.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото
          <img src={current.photo} alt="" className={styles['team-slide__photo']} />
        ) : (
          <span className={styles['team-slide__photo-placeholder']}>
            {current.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className={styles['team-slide__name']}>{current.name}</span>
        {current.role && <span className={styles['team-slide__role']}>{current.role}</span>}
        {current.bio && <p className={styles['team-slide__bio']}>{current.bio}</p>}
        {props.items.length > 1 && (
          <div className={styles['testimonial-slide__nav']}>
            <button
              type="button"
              className={styles['testimonial-slide__arrow']}
              aria-label="Предыдущий сотрудник"
              onClick={prev}
            >
              <ChevronRightIcon className={styles['testimonial-slide__arrow-icon--prev']} />
            </button>
            <div className={styles['testimonial-slide__dots']} role="tablist">
              {props.items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Сотрудник ${index + 1}`}
                  className={cn(
                    styles['testimonial-slide__dot'],
                    index === active && styles['testimonial-slide__dot--active'],
                  )}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles['testimonial-slide__arrow']}
              aria-label="Следующий сотрудник"
              onClick={next}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

registerBlock<TeamSliderProps>({
  type: 'teamslider',
  label: 'Команда (слайдер)',
  category: 'business',
  icon: GlobeIcon,
  description: 'Сотрудники по одному, крупно, с автопрокруткой',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Сотрудники',
      control: 'list',
      itemLabel: 'Сотрудник',
      max: 10,
      itemFields: [
        { key: 'photo', label: 'Фото', control: 'image' },
        { key: 'name', label: 'Имя', control: 'text' },
        { key: 'role', label: 'Должность', control: 'text' },
        { key: 'bio', label: 'Пару слов', control: 'textarea', rows: 3 },
      ],
    },
    { key: 'autoPlay', label: 'Автопрокрутка', control: 'toggle' },
    { key: 'interval', label: 'Интервал автопрокрутки (сек)', control: 'number', min: 2, max: 15 },
  ],
  Renderer: TeamSliderRenderer,
});

// --- Video testimonial slider ----------------------------------------------
// Композиция двух уже существующих кусков, не третий с нуля: карусель
// `useCarousel`/`.testimonial-slide__nav` у `testimonialsslider` выше +
// iframe/плейсхолдер/подпись у `videotestimonial` (`.video-testimonial__*`,
// объявлен раньше в этом же файле) — для случая, когда видео-отзывов
// несколько и нужен один слайдер, а не N отдельных блоков подряд.

interface VideoTestimonialSlide {
  embedUrl: string;
  authorName: string;
  authorRole: string;
}

interface VideoTestimonialSliderProps {
  eyebrow: string;
  heading: string;
  items: VideoTestimonialSlide[];
  autoPlay: boolean;
  interval: number;
}

function VideoTestimonialSliderRenderer({
  props,
  isEditing,
  onEditProp,
}: BlockRendererProps<VideoTestimonialSliderProps>) {
  const editable = Boolean(isEditing && onEditProp);
  const { active, goTo, next, prev } = useCarousel(
    props.items.length,
    props.autoPlay,
    props.interval,
  );
  const current = props.items[active] ?? props.items[0];

  if (!current) return null;

  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        editable={editable}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
      />
      <div className={styles['testimonial-slide']}>
        {current.embedUrl ? (
          <div className={styles['video-testimonial__frame']}>
            <iframe
              src={current.embedUrl}
              title={current.authorName || 'Видео-отзыв'}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className={styles['video-testimonial__placeholder']}>
            <VideoIcon />
            <span>Вставьте ссылку для встраивания видео</span>
          </div>
        )}
        {(current.authorName || current.authorRole) && (
          <p className={styles['video-testimonial__author']}>
            {current.authorName}
            {current.authorRole && (
              <span className={styles['video-testimonial__author-role']}>
                {' '}
                — {current.authorRole}
              </span>
            )}
          </p>
        )}
        {props.items.length > 1 && (
          <div className={styles['testimonial-slide__nav']}>
            <button
              type="button"
              className={styles['testimonial-slide__arrow']}
              aria-label="Предыдущий отзыв"
              onClick={prev}
            >
              <ChevronRightIcon className={styles['testimonial-slide__arrow-icon--prev']} />
            </button>
            <div className={styles['testimonial-slide__dots']} role="tablist">
              {props.items.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Отзыв ${index + 1}`}
                  className={cn(
                    styles['testimonial-slide__dot'],
                    index === active && styles['testimonial-slide__dot--active'],
                  )}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles['testimonial-slide__arrow']}
              aria-label="Следующий отзыв"
              onClick={next}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

registerBlock<VideoTestimonialSliderProps>({
  type: 'videotestimonialslider',
  label: 'Видео-отзывы (слайдер)',
  category: 'business',
  icon: VideoIcon,
  description: 'Несколько видео-отзывов по одному, с автопрокруткой',
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
  fields: [
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'heading', label: 'Заголовок', control: 'text' },
    {
      key: 'items',
      label: 'Видео-отзывы',
      control: 'list',
      itemLabel: 'Отзыв',
      max: 10,
      itemFields: [
        {
          key: 'embedUrl',
          label: 'Ссылка для встраивания',
          control: 'url',
          hint: 'Например, ссылка «Встроить» из YouTube или Vimeo',
        },
        { key: 'authorName', label: 'Автор', control: 'text' },
        { key: 'authorRole', label: 'Должность / компания', control: 'text' },
      ],
    },
    { key: 'autoPlay', label: 'Автопрокрутка', control: 'toggle' },
    { key: 'interval', label: 'Интервал автопрокрутки (сек)', control: 'number', min: 2, max: 15 },
  ],
  Renderer: VideoTestimonialSliderRenderer,
});

// --- Quote spotlight -----------------------------------------------------

interface QuoteSpotlightProps {
  quote: string;
  authorName: string;
  authorRole: string;
}

function QuoteSpotlightRenderer({ props }: BlockRendererProps<QuoteSpotlightProps>) {
  return (
    <div className={styles['quote-spotlight']}>
      <QuoteIcon className={styles['quote-spotlight__icon']} />
      <p className={styles['quote-spotlight__text']}>{props.quote}</p>
      {(props.authorName || props.authorRole) && (
        <p className={styles['quote-spotlight__author']}>
          {props.authorName}
          {props.authorRole && (
            <span className={styles['quote-spotlight__author-role']}> — {props.authorRole}</span>
          )}
        </p>
      )}
    </div>
  );
}

registerBlock<QuoteSpotlightProps>({
  type: 'quotespotlight',
  label: 'Крупная цитата',
  category: 'business',
  icon: QuoteIcon,
  description: 'Один заметный отзыв или цитата на всю ширину секции',
  defaultProps: {
    quote: 'Лучшее решение, которое мы приняли в этом году.',
    authorName: 'Имя Фамилия',
    authorRole: 'Генеральный директор, Компания',
  },
  fields: [
    { key: 'quote', label: 'Текст цитаты', control: 'textarea', rows: 3 },
    { key: 'authorName', label: 'Автор', control: 'text' },
    { key: 'authorRole', label: 'Должность / компания', control: 'text' },
  ],
  Renderer: QuoteSpotlightRenderer,
});

// --- Video testimonial ---------------------------------------------------
// Тот же формат встраивания, что у `video` (`blocks/media/index.tsx`) —
// `embedUrl` для YouTube/Vimeo, не файл — плюс имя/должность автора, как у
// `quotespotlight`. Отдельный тип, а не поле «видео вместо текста» у
// `quotespotlight` — там `quote` обязателен и держит цитату текстом для
// SEO/доступности (видео его не подменяет), здесь видео — единственный
// контент.

interface VideoTestimonialProps {
  embedUrl: string;
  authorName: string;
  authorRole: string;
}

function VideoTestimonialRenderer({ props }: BlockRendererProps<VideoTestimonialProps>) {
  return (
    <div className={styles['video-testimonial']}>
      {props.embedUrl ? (
        <div className={styles['video-testimonial__frame']}>
          <iframe
            src={props.embedUrl}
            title={props.authorName || 'Видео-отзыв'}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className={styles['video-testimonial__placeholder']}>
          <VideoIcon />
          <span>Вставьте ссылку для встраивания видео</span>
        </div>
      )}
      {(props.authorName || props.authorRole) && (
        <p className={styles['video-testimonial__author']}>
          {props.authorName}
          {props.authorRole && (
            <span className={styles['video-testimonial__author-role']}> — {props.authorRole}</span>
          )}
        </p>
      )}
    </div>
  );
}

registerBlock<VideoTestimonialProps>({
  type: 'videotestimonial',
  label: 'Видео-отзыв',
  category: 'business',
  icon: VideoIcon,
  description: 'Отзыв клиента на видео вместо текста',
  defaultProps: {
    embedUrl: '',
    authorName: 'Имя Фамилия',
    authorRole: 'Клиент',
  },
  fields: [
    {
      key: 'embedUrl',
      label: 'Ссылка для встраивания',
      control: 'url',
      hint: 'Например, ссылка «Встроить» из YouTube или Vimeo',
    },
    { key: 'authorName', label: 'Автор', control: 'text' },
    { key: 'authorRole', label: 'Должность / компания', control: 'text' },
  ],
  Renderer: VideoTestimonialRenderer,
});

// --- Social proof bar ------------------------------------------------------
// Компактная полоса доверия — не полноценная секция с заголовком (как
// `reviews`/`testimonials`), а короткая строка «аватары + рейтинг + текст»,
// обычно ставится под кнопкой в хиро или в шапке. `rating` — просто число
// (владелец вписывает сам), не агрегат из реальных Review — на сайте пока
// нет системы сбора отзывов с оценками от посетителей, только витрины
// текста, который вписывает сам владелец (см. `reviews` выше).

interface SocialProofAvatar {
  photo: string | null;
}

interface SocialProofBarProps {
  avatars: SocialProofAvatar[];
  rating: number;
  ratingText: string;
}

function SocialProofBarRenderer({ props }: BlockRendererProps<SocialProofBarProps>) {
  return (
    <div className={styles['social-proof']}>
      {props.avatars.length > 0 && (
        <div className={styles['social-proof__avatars']}>
          {props.avatars.map((avatar, index) =>
            avatar.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото, произвольный источник
              <img
                key={index}
                src={avatar.photo}
                alt=""
                className={styles['social-proof__avatar']}
              />
            ) : (
              <span key={index} className={styles['social-proof__avatar-placeholder']} />
            ),
          )}
        </div>
      )}
      {props.rating > 0 && (
        <span className={styles['social-proof__rating']}>
          {Array.from({ length: 5 }, (_, index) => (
            <StarIcon
              key={index}
              className={
                index < Math.round(props.rating)
                  ? styles['social-proof__star--filled']
                  : styles['social-proof__star']
              }
            />
          ))}
          <span className={styles['social-proof__rating-number']}>{props.rating.toFixed(1)}</span>
        </span>
      )}
      {props.ratingText && <span className={styles['social-proof__text']}>{props.ratingText}</span>}
    </div>
  );
}

registerBlock<SocialProofBarProps>({
  type: 'socialproofbar',
  label: 'Полоса доверия',
  category: 'business',
  icon: GroupsIcon,
  description: 'Компактная строка «аватары + рейтинг» — под кнопкой в хиро или в шапке',
  defaultProps: {
    avatars: [{ photo: null }, { photo: null }, { photo: null }, { photo: null }],
    rating: 4.9,
    ratingText: '500+ довольных клиентов',
  },
  fields: [
    {
      key: 'avatars',
      label: 'Аватары',
      control: 'list',
      itemLabel: 'Аватар',
      max: 6,
      itemFields: [{ key: 'photo', label: 'Фото', control: 'image' }],
    },
    { key: 'rating', label: 'Рейтинг (0–5)', control: 'number', min: 0, max: 5, step: 0.1 },
    { key: 'ratingText', label: 'Текст', control: 'text' },
  ],
  Renderer: SocialProofBarRenderer,
});
