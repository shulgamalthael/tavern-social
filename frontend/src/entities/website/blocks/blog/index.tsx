'use client';

import { useCallback } from 'react';
import { getPublicBlogPosts, type PublicBlogPost } from '@/entities/blog-post';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { NewspaperIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import type { DataSourceValue } from '../../model/types';
import { RepeatableSimpleCards, type SimpleCardItem } from '../shared/RepeatableSimpleCards';
import styles from './blog.module.scss';

// --- BlogGrid --------------------------------------------------------------
// Зеркало `productgrid`/`servicegrid` для Content (см. ROADMAP.md §8 Phase
// 7) — тот же data-driven паттерн (`dataSource`). В отличие от них,
// переиспользует общую `RepeatableSimpleCards` (как `cards`/`articles` в
// `blocks/content`), а не собственную карточку с кнопкой-действием: у поста
// нет действия вроде «в корзину»/«записаться» — только переход на страницу
// чтения (`/blog/{slug}`, см. `app/site/[businessId]/blog/[postSlug]/
// page.tsx`), а обычная ссылка — это ровно то, что `RepeatableSimpleCards`
// уже умеет через `SimpleCardItem.url`.

interface BlogGridProps {
  eyebrow: string;
  heading: string;
  description: string;
  dataSource: DataSourceValue;
  columns: number;
}

/** Сортировка по цене здесь недостижима (см. `DataSourceField`, `entity:
 * 'post'` скрывает эти варианты в инспекторе) — `newest` уже порядок
 * `listPublic` на backend, как и у `productgrid`/`servicegrid`. */
function sortPosts(posts: PublicBlogPost[]): PublicBlogPost[] {
  return posts;
}

function BlogGridRenderer({
  props,
  business,
  pages,
  isEditing,
  onEditProp,
}: BlockRendererProps<BlogGridProps>) {
  const fetcher = useCallback(() => getPublicBlogPosts(business.businessId), [business.businessId]);
  const { status, data, error } = useAsyncData(fetcher);

  if (status === 'loading') {
    return (
      <div className={styles.placeholder}>
        <NewspaperIcon />
        <span>Загружаем посты…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.placeholder}>
        <NewspaperIcon />
        <span>{error ?? 'Не удалось загрузить посты'}</span>
      </div>
    );
  }

  const sorted = sortPosts(data ?? []);
  const limited = sorted.slice(0, props.dataSource.limit);

  if (limited.length === 0) {
    return (
      <div className={styles.placeholder}>
        <NewspaperIcon />
        <span>Здесь пока нет постов — добавьте их в разделе «Блог» дашборда бизнеса.</span>
      </div>
    );
  }

  const items: SimpleCardItem[] = limited.map((post) => ({
    image: post.coverImage,
    title: post.title,
    description: post.excerpt,
    // `type: 'external'` — не буквально внешний адрес, просто ближайший
    // вариант `LinkTarget` для «уже готовый относительный путь, резолвить
    // нечего» (см. `resolveLinkHref`: `external` возвращает `target.url` как
    // есть). `type: 'page'` сюда не подходит — тот резолвит `pageId` среди
    // страниц САЙТА (`WebsitePage`), а посты блога не страницы сайта и не
    // участвуют в этом списке (см. ROADMAP.md §3.2 — система страниц не
    // создаёт `WebsitePage` на каждую сущность капабилити).
    url: { type: 'external', url: `/blog/${post.slug}` },
  }));

  return (
    <RepeatableSimpleCards
      eyebrow={props.eyebrow}
      heading={props.heading}
      description={props.description}
      items={items}
      columns={props.columns}
      pages={pages}
      editable={Boolean(isEditing && onEditProp)}
      onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
      onEditHeading={(value) => onEditProp?.('heading', value)}
      onEditDescription={(value) => onEditProp?.('description', value)}
    />
  );
}

const blogGridFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  { key: 'dataSource', label: 'Посты', control: 'dataSource', entity: 'post' },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

registerBlock<BlogGridProps>({
  type: 'bloggrid',
  label: 'Блог',
  category: 'blog',
  icon: NewspaperIcon,
  description: 'Посты из раздела «Блог» дашборда — заголовок, анонс и фото, ссылка на чтение',
  capability: 'content',
  defaultProps: {
    eyebrow: '',
    heading: 'Новости и статьи',
    description: '',
    dataSource: { limit: 6, sort: 'newest' },
    columns: 3,
  },
  fields: blogGridFields,
  Renderer: BlogGridRenderer,
});
