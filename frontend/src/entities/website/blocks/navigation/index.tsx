import { ChevronRightIcon, GlobeIcon, RowsIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget } from '../../model/types';
import styles from './navigation.module.scss';

// --- Footer --------------------------------------------------------------

interface FooterLink {
  label: string;
  url: LinkTarget;
}

interface FooterProps {
  navLinks: FooterLink[];
  copyrightText: string;
}

function FooterRenderer({ props, business, pages }: BlockRendererProps<FooterProps>) {
  return (
    <footer className={styles.footer}>
      <div className={styles['footer__top']}>
        <span className={styles['footer__brand']}>
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- логотип бизнеса
            <img src={business.logoUrl} alt="" className={styles['footer__logo']} />
          ) : null}
          {business.name}
        </span>
        {props.navLinks.length > 0 && (
          <nav className={styles['footer__nav']}>
            {props.navLinks.map((link, index) => (
              <a key={index} href={resolveLinkHref(link.url, pages)}>
                {link.label}
              </a>
            ))}
          </nav>
        )}
        {business.socialLinks.length > 0 && (
          <div className={styles['footer__social']}>
            {business.socialLinks.map((link, index) => (
              <a key={index} href={link.url} target="_blank" rel="noopener noreferrer">
                <GlobeIcon />
              </a>
            ))}
          </div>
        )}
      </div>
      <span className={styles['footer__copyright']}>
        {props.copyrightText || `© ${new Date().getFullYear()} ${business.name}`}
      </span>
    </footer>
  );
}

const footerFields: FieldSchema[] = [
  {
    key: 'navLinks',
    label: 'Ссылки',
    control: 'list',
    itemLabel: 'Ссылка',
    max: 6,
    itemFields: [
      { key: 'label', label: 'Текст', control: 'text' },
      { key: 'url', label: 'Адрес', control: 'link' },
    ],
  },
  {
    key: 'copyrightText',
    label: 'Текст копирайта',
    control: 'text',
    placeholder: '© 2026 Ваш бизнес',
  },
];

registerBlock<FooterProps>({
  type: 'footer',
  label: 'Подвал сайта',
  category: 'navigation',
  icon: RowsIcon,
  description: 'Низ страницы — лого, ссылки и копирайт',
  defaultProps: {
    navLinks: [
      { label: 'О нас', url: { type: 'anchor', anchor: 'about' } },
      { label: 'Контакты', url: { type: 'anchor', anchor: 'contact' } },
    ],
    copyrightText: '',
  },
  defaultStyle: { background: 'dark', paddingY: 'lg' },
  fields: footerFields,
  Renderer: FooterRenderer,
});

// --- Breadcrumbs -----------------------------------------------------------

interface BreadcrumbItem {
  label: string;
  url: LinkTarget;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

function BreadcrumbsRenderer({ props, pages }: BlockRendererProps<BreadcrumbsProps>) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
      {props.items.map((item, index) => (
        <span key={index} className={styles['breadcrumbs__item']}>
          {index > 0 && <ChevronRightIcon className={styles['breadcrumbs__separator']} />}
          {index === props.items.length - 1 ? (
            <span aria-current="page">{item.label}</span>
          ) : (
            <a href={resolveLinkHref(item.url, pages)}>{item.label}</a>
          )}
        </span>
      ))}
    </nav>
  );
}

registerBlock<BreadcrumbsProps>({
  type: 'breadcrumbs',
  label: 'Хлебные крошки',
  category: 'navigation',
  icon: ChevronRightIcon,
  description: 'Путь навигации по страницам сайта',
  defaultProps: {
    items: [
      { label: 'Главная', url: { type: 'page', pageId: '' } },
      { label: 'Текущая страница', url: { type: 'anchor', anchor: '' } },
    ],
  },
  fields: [
    {
      key: 'items',
      label: 'Пункты',
      control: 'list',
      itemLabel: 'Пункт',
      itemFields: [
        { key: 'label', label: 'Текст', control: 'text' },
        { key: 'url', label: 'Ссылка', control: 'link' },
      ],
    },
  ],
  Renderer: BreadcrumbsRenderer,
});
