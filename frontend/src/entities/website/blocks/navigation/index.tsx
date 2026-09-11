'use client';

import { useEffect, useState } from 'react';
import { getPublicBlogPosts } from '@/entities/blog-post';
import { getPublicCustomEntityRecords } from '@/entities/custom-entity';
import { getPublicProducts } from '@/entities/product';
import { getPublicServices } from '@/entities/service';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { cn } from '@/shared/lib/cn';
import { ChevronRightIcon, CloseIcon, GlobeIcon, RowsIcon, SearchIcon } from '@/shared/ui/icons';
import { AddToCartButton, BookAppointmentButton } from '../actions';
import {
  buildCustomEntityResults,
  buildPostResults,
  buildProductResults,
  buildServiceResults,
  filterSearchResults,
  type EntitySearchResult,
} from '../../lib/entity-search';
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

// --- Entity search -----------------------------------------------------
// Живой поиск по данным бизнеса — до 4 источников сразу (Товары/Услуги/
// Статьи блога и/или собственные Custom Entities, помеченные владельцем
// публичными, см. `CustomEntitiesSection`'s переключатель "Публично" в
// дашборде). Сам блок не хранит результаты в `props` — только конфигурацию
// источников; сами данные каждого источника дозагружаются целиком (тот же
// принцип, что у `productgrid`/`servicegrid`/`bloggrid`: каталоги малы, см.
// ROADMAP.md §8 Phase 14), а поиск — обычная подстрочная фильтрация на
// клиенте (`filterSearchResults`, `../../lib/entity-search.ts`), не запрос
// к серверу на каждое нажатие клавиши.

interface EntitySearchSource {
  entity: 'product' | 'service' | 'post' | 'custom';
  /** Имеет смысл только при `entity === 'custom'` — точное название
   * сущности из раздела "База данных" (не внутренний id, см.
   * `PublicCustomEntity`'s комментарий в `entities/custom-entity`). */
  entityName: string;
  label: string;
}

interface EntitySearchProps {
  placeholder: string;
  emptyText: string;
  resultsLimit: number;
  sources: EntitySearchSource[];
}

/** Обёрнута в try/catch ЦЕЛИКОМ (не только вокруг custom-сегмента, как было
 * до найденного самостоятельным ревью бага) — любая из четырёх ветвей может
 * реально упасть, не только резолв кастомной сущности по имени:
 * `businessId` бывает пустой строкой в контексте живого превью блока в
 * библиотеке компонентов (`BlockThumbnail` рендерит `defaultProps` с
 * заглушечным бизнесом без реального id, см. её комментарий), из-за чего
 * `getPublicProducts('')`/`getPublicServices('')`/`getPublicBlogPosts('')`
 * бьются в backend на `GET /sites//products` (404) — раньше это падало
 * необработанным исключением Server Action (виден как 500 в логе dev-
 * сервера при каждом открытии панели блоков). Один упавший источник
 * по-прежнему должен молча дать 0 результатов, не ронять остальные. */
async function loadSearchSource(
  businessId: string,
  source: EntitySearchSource,
): Promise<EntitySearchResult[]> {
  // Пустой `businessId` — заглушечный бизнес превью в библиотеке блоков
  // (`PLACEHOLDER_BUSINESS`, `BlockThumbnail.tsx`) — не сетевая ошибка,
  // которую стоит пытаться и ловить, а сигнал вообще не делать запрос: с
  // пустым id backend всегда ответит 404 (`GET /sites//products`), и хотя
  // `try/catch` ниже не даёт этому уронить рендер, сам HTTP-запрос Server
  // Action всё равно долетает до backend и логируется как настоящая ошибка
  // сервера — реального сетевого запроса здесь просто не должно быть.
  if (!businessId) return [];

  try {
    if (source.entity === 'product') {
      return buildProductResults(await getPublicProducts(businessId));
    }
    if (source.entity === 'service') {
      return buildServiceResults(await getPublicServices(businessId));
    }
    if (source.entity === 'post') {
      return buildPostResults(await getPublicBlogPosts(businessId));
    }

    const entityName = source.entityName.trim();
    if (!entityName) return [];
    const data = await getPublicCustomEntityRecords(businessId, entityName);
    return buildCustomEntityResults(data, source.label || data.entityName);
  } catch {
    return [];
  }
}

/** Загружает и объединяет ВСЕ настроенные источники один раз (при монтаже
 * блока/смене состава источников), не при каждом нажатии клавиши — сама
 * фильтрация по запросу дальше чисто локальная (`filterSearchResults`).
 * `status` не возвращается к `'loading'` при повторной загрузке (смена
 * `sources`) — уже показанные результаты остаются видны, пока не придут
 * новые (stale-while-revalidate), это не эффект, который синхронно пишет
 * состояние в теле самого эффекта (см. `react-hooks/set-state-in-effect` —
 * тот же приём, что у `useLiveCountdown`, `blocks/content/index.tsx`). */
function useEntitySearchIndex(
  businessId: string,
  sources: EntitySearchSource[],
): { status: AsyncStatus; results: EntitySearchResult[] } {
  const [state, setState] = useState<{ status: AsyncStatus; results: EntitySearchResult[] }>({
    status: 'loading',
    results: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const perSource = await Promise.all(
          sources.map((source) => loadSearchSource(businessId, source)),
        );
        if (!cancelled) setState({ status: 'success', results: perSource.flat() });
      } catch {
        if (!cancelled) setState({ status: 'error', results: [] });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, sources]);

  return state;
}

function EntitySearchResultRow({
  result,
  businessId,
  isEditing,
}: {
  result: EntitySearchResult;
  businessId: string;
  isEditing?: boolean;
}) {
  return (
    <div className={styles['search__result']} role="option" aria-selected={false}>
      <div className={styles['search__result-text']}>
        <span className={styles['search__result-title']}>{result.title}</span>
        {result.subtitle && (
          <span className={styles['search__result-subtitle']}>{result.subtitle}</span>
        )}
      </div>
      {result.entity === 'product' && result.productId && (
        <AddToCartButton
          productId={result.productId}
          label="В корзину"
          variant="soft"
          size="sm"
          businessId={businessId}
          isEditing={isEditing}
        />
      )}
      {result.entity === 'service' && result.serviceId && (
        <BookAppointmentButton
          serviceId={result.serviceId}
          label="Записаться"
          variant="soft"
          size="sm"
          businessId={businessId}
          isEditing={isEditing}
        />
      )}
      {result.entity === 'post' && result.href && (
        <a href={result.href} className={styles['search__result-link']}>
          Читать
        </a>
      )}
    </div>
  );
}

function EntitySearchRenderer({
  props,
  business,
  isEditing,
}: BlockRendererProps<EntitySearchProps>) {
  const [query, setQuery] = useState('');
  const { status, results: index } = useEntitySearchIndex(business.businessId, props.sources);

  const trimmed = query.trim();
  const showPanel = trimmed.length > 0;
  const matches = showPanel ? filterSearchResults(index, query, props.resultsLimit) : [];

  return (
    <div className={styles.search}>
      <div className={styles['search__field']}>
        <SearchIcon className={styles['search__icon']} />
        <input
          type="search"
          className={styles['search__input']}
          placeholder={props.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
          aria-label={props.placeholder || 'Поиск по сайту'}
        />
        {query && (
          <button
            type="button"
            className={styles['search__clear']}
            aria-label="Очистить поиск"
            onClick={() => setQuery('')}
          >
            <CloseIcon />
          </button>
        )}
      </div>
      {showPanel && (
        <div className={styles['search__panel']} role="listbox">
          {status === 'loading' && index.length === 0 ? (
            <p className={styles['search__status']}>Загрузка…</p>
          ) : status === 'error' && index.length === 0 ? (
            <p className={styles['search__status']}>Не удалось загрузить данные для поиска</p>
          ) : matches.length === 0 ? (
            <p className={styles['search__status']}>{props.emptyText}</p>
          ) : (
            matches.map((result) => (
              <EntitySearchResultRow
                key={result.key}
                result={result}
                businessId={business.businessId}
                isEditing={isEditing}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

registerBlock<EntitySearchProps>({
  type: 'entitysearch',
  label: 'Поиск по сайту',
  category: 'navigation',
  icon: SearchIcon,
  description: 'Живой поиск по товарам, услугам, статьям блога и/или своим сущностям',
  defaultProps: {
    placeholder: 'Поиск…',
    emptyText: 'Ничего не найдено',
    resultsLimit: 6,
    sources: [{ entity: 'product', entityName: '', label: 'Товары' }],
  },
  fields: [
    { key: 'placeholder', label: 'Плейсхолдер', control: 'text' },
    { key: 'emptyText', label: 'Текст «ничего не найдено»', control: 'text' },
    { key: 'resultsLimit', label: 'Показывать результатов', control: 'number', min: 3, max: 20 },
    {
      key: 'sources',
      label: 'Источники данных',
      control: 'list',
      itemLabel: 'Источник',
      max: 4,
      itemFields: [
        {
          key: 'entity',
          label: 'Тип',
          control: 'select',
          options: [
            { value: 'product', label: 'Товары' },
            { value: 'service', label: 'Услуги' },
            { value: 'post', label: 'Статьи блога' },
            { value: 'custom', label: 'Своя сущность' },
          ],
        },
        {
          key: 'entityName',
          label: 'Название сущности (для «Своя»)',
          control: 'text',
          hint: 'Точное название из раздела «База данных» — и сущность должна быть отмечена там как публичная.',
        },
        { key: 'label', label: 'Подпись источника', control: 'text' },
      ],
    },
  ],
  Renderer: EntitySearchRenderer,
});

// --- Anchor navigation dots -------------------------------------------------
// Плавающие точки сбоку экрана, каждая — обычная якорная ссылка (`control:
// 'link'`, тот же `LinkTarget`/`resolveLinkHref`, что и у любой другой
// кнопки в реестре) — без подсветки «активного» раздела по скроллу: это
// потребовало бы либо сканировать DOM в поиске заголовков других блоков
// (хрупко — верстка чужого блока не гарантирует, где именно лежит якорь),
// либо просить владельца вручную сопоставить каждую точку с положением на
// странице в пикселях. Простая версия — просто рабочая навигация кликом,
// без лишней хрупкости. `position: fixed` только на публичном сайте, тот
// же `--preview`-приём, что у `stickybar` (`blocks/content/index.tsx`).

interface AnchorNavItem {
  label: string;
  url: LinkTarget;
}

interface AnchorNavProps {
  items: AnchorNavItem[];
  position: 'left' | 'right';
}

function AnchorNavRenderer({ props, pages, isEditing }: BlockRendererProps<AnchorNavProps>) {
  return (
    <nav
      className={cn(
        styles['anchor-nav'],
        styles[`anchor-nav--${props.position}`],
        isEditing && styles['anchor-nav--preview'],
      )}
      aria-label="Быстрая навигация по странице"
    >
      {props.items.map((item, index) => (
        <a
          key={index}
          href={resolveLinkHref(item.url, pages)}
          className={styles['anchor-nav__dot']}
          aria-label={item.label}
          title={item.label}
        />
      ))}
    </nav>
  );
}

registerBlock<AnchorNavProps>({
  type: 'anchornav',
  label: 'Навигация-точки',
  category: 'navigation',
  icon: RowsIcon,
  description: 'Плавающие точки сбоку экрана для быстрой навигации по разделам страницы',
  defaultProps: {
    items: [
      { label: 'Главная', url: { type: 'anchor', anchor: 'top' } },
      { label: 'О нас', url: { type: 'anchor', anchor: 'about' } },
      { label: 'Услуги', url: { type: 'anchor', anchor: 'services' } },
      { label: 'Контакты', url: { type: 'anchor', anchor: 'contact' } },
    ],
    position: 'right',
  },
  fields: [
    {
      key: 'items',
      label: 'Пункты',
      control: 'list',
      itemLabel: 'Пункт',
      max: 8,
      itemFields: [
        { key: 'label', label: 'Подпись (для доступности)', control: 'text' },
        { key: 'url', label: 'Якорь страницы', control: 'link' },
      ],
    },
    {
      key: 'position',
      label: 'Сторона',
      control: 'segmented',
      options: [
        { value: 'left', label: 'Слева' },
        { value: 'right', label: 'Справа' },
      ],
    },
  ],
  Renderer: AnchorNavRenderer,
});
