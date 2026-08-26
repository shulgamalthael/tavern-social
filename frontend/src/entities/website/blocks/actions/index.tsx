import type { ReactNode } from 'react';
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
}

/** Общий рендер одной кнопки — переиспользуют `button`, `buttongroup` (по
 * элементу списка) и `cta` (готовая кнопка внутри промо-блока), поэтому
 * стиль кнопки одинаковый везде на сайте независимо от того, из какого
 * блока она пришла. `url` — структурная `LinkTarget` (см. `resolve-link.ts`),
 * не голая строка: кнопка может вести на внешний адрес, страницу ЭТОГО
 * сайта, якорь, телефон или почту — `resolveLinkHref` разрешает это в
 * реальный `href` заново при каждом рендере (не один раз при сохранении),
 * поэтому переименование/реордер страниц не протухают уже расставленные
 * ссылки на них. */
function SiteButton({ label, url, variant, size, icon, target, pages }: SiteButtonRenderProps) {
  const Icon = icon ? resolveIconChoice(icon) : null;
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
  { key: 'url', label: 'Ссылка', control: 'link' },
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

function ButtonRenderer({ props, pages }: BlockRendererProps<SiteButtonProps>) {
  return <SiteButton {...props} pages={pages} />;
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

function ButtonGroupRenderer({ props, pages }: BlockRendererProps<ButtonGroupProps>) {
  return (
    <div className={styles['button-group']}>
      {props.buttons.map((button, index) => (
        <SiteButton key={index} {...button} size="md" target="_self" pages={pages} />
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
      { key: 'url', label: 'Ссылка', control: 'link' },
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

function CtaRenderer({ props, pages }: BlockRendererProps<CtaProps>): ReactNode {
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
      />
    </div>
  );
}

const ctaFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Текст', control: 'textarea', rows: 2 },
  { key: 'buttonLabel', label: 'Текст кнопки', control: 'text' },
  { key: 'buttonUrl', label: 'Ссылка кнопки', control: 'link' },
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
