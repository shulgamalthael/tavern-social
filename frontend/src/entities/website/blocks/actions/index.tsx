'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { BookingModal } from '@/entities/appointment';
import { useCartStore } from '@/entities/cart';
import { getPublicProducts } from '@/entities/product';
import { getPublicServices, type PublicService } from '@/entities/service';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { ButtonClickIcon, ExternalLinkIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { EMPTY_LINK_TARGET, resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget, WebsitePage } from '../../model/types';
import { resolveIconChoice } from '../shared/icon-choices';
import { SectionHeading } from '../shared/SectionHeading';
import styles from './actions.module.scss';

type ButtonVariant = 'solid' | 'outline' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg';

/** Форма, в которой кнопка реально хранится в `block.props` (сериализуемая,
 * без `pages`) — то, что видит `registerBlock<...>`/`defaultProps`/поля
 * инспектора. Отдельно от `SiteButtonRenderProps` ниже: та добавляет `pages`,
 * которые нужны только в момент рендера (резолвить `url`, если это ссылка
 * на страницу сайта), но никогда не должны сериализоваться вместе с самой
 * кнопкой — `pages` документа целиком меняются независимо от неё. */
interface SiteButtonProps {
  label: string;
  url: LinkTarget;
  variant: ButtonVariant;
  size: ButtonSize;
  icon?: string;
  target: '_self' | '_blank';
}

interface SiteButtonRenderProps extends SiteButtonProps {
  pages: WebsitePage[];
  /** Нужен только вариантам `addToCart`/`bookAppointment` (см. их
   * комментарий в `model/types.ts`) — дозагрузить конкретный товар/услугу
   * по id тем же анонимным вызовом, что и `productgrid`/`servicegrid`.
   * Остальные варианты `url.type` его не используют вообще. */
  businessId: string;
  /** См. `BlockRendererProps.isEditing` — внутри билдера действие не должно
   * реально сработать (положить в корзину/открыть форму записи), тот же
   * принцип, что уже применён к `ProductCard`/`ServiceCard`. */
  isEditing?: boolean;
}

/** Кнопка «В корзину» для конкретного, выбранного в инспекторе товара — не
 * внутри `productgrid`, а САМА ПО СЕБЕ где угодно на странице (например, в
 * hero-секции для одного «хитового» товара). Дозагружает весь публичный
 * каталог и находит нужный по id тем же способом, что `productgrid` уже
 * загружает его целиком для сортировки/среза — отдельного эндпоинта «один
 * товар по id» в проекте нет, и заводить его только ради этой кнопки не
 * стоило: каталоги малы (см. ROADMAP.md §8 Phase 14 — измерено, не
 * предположено), а не полноценная витрина, где N+1-подобная загрузка была
 * бы реальной проблемой. */
function AddToCartButton({
  productId,
  label,
  variant,
  size,
  icon,
  businessId,
  isEditing,
}: {
  productId: string;
  label: string;
  variant: ButtonVariant;
  size: ButtonSize;
  icon?: string;
  businessId: string;
  isEditing?: boolean;
}) {
  const fetcher = useCallback(() => getPublicProducts(businessId), [businessId]);
  const { data } = useAsyncData(fetcher);
  const addItem = useCartStore((state) => state.addItem);
  const Icon = icon ? resolveIconChoice(icon) : null;

  const product = data?.find((item) => item.id === productId);
  const isOutOfStock = product ? product.stock !== null && product.stock <= 0 : false;

  function handleClick() {
    if (isEditing || !product) return;
    addItem({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      image: product.images[0] ?? null,
    });
  }

  if (!label) return null;

  return (
    <button
      type="button"
      className={styles.button}
      data-variant={variant}
      data-size={size}
      disabled={!isEditing && (!product || isOutOfStock)}
      onClick={handleClick}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- см. SiteButton ниже, тот же приём */}
      {Icon && <Icon className={styles.button__icon} />}
      {!isEditing && data && !product
        ? 'Товар удалён'
        : !isEditing && isOutOfStock
          ? 'Нет в наличии'
          : label}
    </button>
  );
}

/** Кнопка «Записаться» для конкретной, выбранной в инспекторе услуги — тот
 * же принцип, что и `AddToCartButton` выше, только открывает `BookingModal`
 * вместо похода в корзину (у записи корзины нет, см. `ServiceCard` в
 * `blocks/booking/index.tsx`, откуда этот приём взят один в один). */
function BookAppointmentButton({
  serviceId,
  label,
  variant,
  size,
  icon,
  businessId,
  isEditing,
}: {
  serviceId: string;
  label: string;
  variant: ButtonVariant;
  size: ButtonSize;
  icon?: string;
  businessId: string;
  isEditing?: boolean;
}) {
  const fetcher = useCallback(() => getPublicServices(businessId), [businessId]);
  const { data } = useAsyncData(fetcher);
  const [isBooking, setBooking] = useState(false);
  const Icon = icon ? resolveIconChoice(icon) : null;

  const service: PublicService | undefined = data?.find((item) => item.id === serviceId);

  if (!label) return null;

  return (
    <>
      <button
        type="button"
        className={styles.button}
        data-variant={variant}
        data-size={size}
        disabled={!isEditing && data !== undefined && !service}
        onClick={() => {
          if (!isEditing && service) setBooking(true);
        }}
      >
        {/* eslint-disable-next-line react-hooks/static-components -- см. SiteButton ниже, тот же приём */}
        {Icon && <Icon className={styles.button__icon} />}
        {!isEditing && data && !service ? 'Услуга удалена' : label}
      </button>

      {isBooking && service && (
        <BookingModal businessId={businessId} service={service} onClose={() => setBooking(false)} />
      )}
    </>
  );
}

/** Общий рендер одной кнопки — переиспользуют `button`, `buttongroup` (по
 * элементу списка) и `cta` (готовая кнопка внутри промо-блока), поэтому
 * стиль кнопки одинаковый везде на сайте независимо от того, из какого
 * блока она пришла. `url` — структурная `LinkTarget` (см. `resolve-link.ts`),
 * не голая строка: кнопка может вести на внешний адрес, страницу ЭТОГО
 * сайта, якорь, телефон, почту — `resolveLinkHref` разрешает это в реальный
 * `href` заново при каждом рендере (не один раз при сохранении), поэтому
 * переименование/реордер страниц не протухают уже расставленные ссылки на
 * них — или выполнить настоящее действие (`addToCart`/`bookAppointment`, см.
 * их комментарий в `model/types.ts`), для которых `<a href>` в принципе не
 * подходящий тег. */
function SiteButton({
  label,
  url,
  variant,
  size,
  icon,
  target,
  pages,
  businessId,
  isEditing,
}: SiteButtonRenderProps) {
  const Icon = icon ? resolveIconChoice(icon) : null;

  if (url.type === 'addToCart') {
    return (
      <AddToCartButton
        productId={url.productId}
        label={label}
        variant={variant}
        size={size}
        icon={icon}
        businessId={businessId}
        isEditing={isEditing}
      />
    );
  }

  if (url.type === 'bookAppointment') {
    return (
      <BookAppointmentButton
        serviceId={url.serviceId}
        label={label}
        variant={variant}
        size={size}
        icon={icon}
        businessId={businessId}
        isEditing={isEditing}
      />
    );
  }

  if (!label) return null;

  return (
    <a
      href={resolveLinkHref(url, pages)}
      target={target === '_blank' ? '_blank' : undefined}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      className={styles.button}
      data-variant={variant}
      data-size={size}
    >
      {/* eslint-disable-next-line react-hooks/static-components -- resolveIconChoice читает стабильную ссылку из статической карты (см. icon-choices.ts), не создаёт новый компонент на каждый рендер */}
      {Icon && <Icon className={styles.button__icon} />}
      {label}
    </a>
  );
}

// --- Button ------------------------------------------------------------

const buttonFields: FieldSchema[] = [
  { key: 'label', label: 'Текст кнопки', control: 'text' },
  { key: 'url', label: 'Ссылка', control: 'link', actionsEnabled: true },
  {
    key: 'variant',
    label: 'Стиль',
    control: 'select',
    options: [
      { value: 'solid', label: 'Заливка' },
      { value: 'outline', label: 'Контур' },
      { value: 'soft', label: 'Приглушённый' },
    ],
  },
  {
    key: 'size',
    label: 'Размер',
    control: 'select',
    options: [
      { value: 'sm', label: 'Маленький' },
      { value: 'md', label: 'Средний' },
      { value: 'lg', label: 'Крупный' },
    ],
  },
  {
    key: 'target',
    label: 'Открывать',
    control: 'select',
    options: [
      { value: '_self', label: 'В этой же вкладке' },
      { value: '_blank', label: 'В новой вкладке' },
    ],
  },
];

function ButtonRenderer({
  props,
  pages,
  business,
  isEditing,
}: BlockRendererProps<SiteButtonProps>) {
  return (
    <SiteButton {...props} pages={pages} businessId={business.businessId} isEditing={isEditing} />
  );
}

registerBlock<SiteButtonProps>({
  type: 'button',
  label: 'Кнопка',
  category: 'actions',
  icon: ButtonClickIcon,
  description: 'Одна кнопка со ссылкой',
  defaultProps: {
    label: 'Узнать больше',
    url: EMPTY_LINK_TARGET,
    variant: 'solid',
    size: 'md',
    target: '_self',
  },
  fields: buttonFields,
  Renderer: ButtonRenderer,
});

// --- ButtonGroup -------------------------------------------------------

interface ButtonGroupItem {
  label: string;
  url: LinkTarget;
  variant: ButtonVariant;
}

interface ButtonGroupProps {
  buttons: ButtonGroupItem[];
}

function ButtonGroupRenderer({
  props,
  pages,
  business,
  isEditing,
}: BlockRendererProps<ButtonGroupProps>) {
  return (
    <div className={styles['button-group']}>
      {props.buttons.map((button, index) => (
        <SiteButton
          key={index}
          {...button}
          size="md"
          target="_self"
          pages={pages}
          businessId={business.businessId}
          isEditing={isEditing}
        />
      ))}
    </div>
  );
}

const buttonGroupFields: FieldSchema[] = [
  {
    key: 'buttons',
    label: 'Кнопки',
    control: 'list',
    itemLabel: 'Кнопка',
    max: 4,
    itemFields: [
      { key: 'label', label: 'Текст', control: 'text' },
      { key: 'url', label: 'Ссылка', control: 'link', actionsEnabled: true },
      {
        key: 'variant',
        label: 'Стиль',
        control: 'select',
        options: [
          { value: 'solid', label: 'Заливка' },
          { value: 'outline', label: 'Контур' },
          { value: 'soft', label: 'Приглушённый' },
        ],
      },
    ],
  },
];

registerBlock<ButtonGroupProps>({
  type: 'buttongroup',
  label: 'Группа кнопок',
  category: 'actions',
  icon: ButtonClickIcon,
  description: 'Несколько кнопок рядом',
  defaultProps: {
    buttons: [
      { label: 'Записаться', url: EMPTY_LINK_TARGET, variant: 'solid' },
      { label: 'Узнать больше', url: EMPTY_LINK_TARGET, variant: 'outline' },
    ],
  },
  fields: buttonGroupFields,
  Renderer: ButtonGroupRenderer,
});

// --- Link ----------------------------------------------------------------

interface LinkProps {
  label: string;
  url: LinkTarget;
  target: '_self' | '_blank';
}

function LinkRenderer({ props, pages }: BlockRendererProps<LinkProps>) {
  if (!props.label) return null;
  return (
    <a
      href={resolveLinkHref(props.url, pages)}
      target={props.target === '_blank' ? '_blank' : undefined}
      rel={props.target === '_blank' ? 'noopener noreferrer' : undefined}
      className={styles.link}
    >
      {props.label}
    </a>
  );
}

const linkFields: FieldSchema[] = [
  { key: 'label', label: 'Текст ссылки', control: 'text' },
  { key: 'url', label: 'Адрес', control: 'link' },
  {
    key: 'target',
    label: 'Открывать',
    control: 'select',
    options: [
      { value: '_self', label: 'В этой же вкладке' },
      { value: '_blank', label: 'В новой вкладке' },
    ],
  },
];

registerBlock<LinkProps>({
  type: 'link',
  label: 'Ссылка',
  category: 'actions',
  icon: ExternalLinkIcon,
  description: 'Простая текстовая ссылка',
  defaultProps: { label: 'Подробнее →', url: EMPTY_LINK_TARGET, target: '_self' },
  fields: linkFields,
  Renderer: LinkRenderer,
});

// --- CTA -----------------------------------------------------------------

interface CtaProps {
  eyebrow: string;
  heading: string;
  description: string;
  buttonLabel: string;
  buttonUrl: LinkTarget;
}

function CtaRenderer({
  props,
  pages,
  business,
  isEditing,
}: BlockRendererProps<CtaProps>): ReactNode {
  return (
    <div className={styles.cta}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
      />
      <SiteButton
        label={props.buttonLabel}
        url={props.buttonUrl}
        variant="solid"
        size="lg"
        target="_self"
        pages={pages}
        businessId={business.businessId}
        isEditing={isEditing}
      />
    </div>
  );
}

const ctaFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Текст', control: 'textarea', rows: 2 },
  { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
  { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link', actionsEnabled: true },
];

registerBlock<CtaProps>({
  type: 'cta',
  label: 'Призыв к действию',
  category: 'actions',
  icon: ButtonClickIcon,
  description: 'Крупный промо-блок с кнопкой',
  defaultProps: {
    eyebrow: '',
    heading: 'Готовы начать?',
    description: 'Свяжитесь с нами — ответим в течение дня.',
    buttonLabel: 'Связаться',
    buttonUrl: EMPTY_LINK_TARGET,
  },
  defaultStyle: { background: 'primary', paddingY: 'lg', textAlign: 'center' },
  fields: ctaFields,
  Renderer: CtaRenderer,
});
