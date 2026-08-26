'use client';

import Link from 'next/link';
import { useCallback, type CSSProperties } from 'react';
import { getPublicBlogPostBySlug } from '@/entities/blog-post';
import { buildThemeCssVars, getAnonymousPublicSite } from '@/entities/website';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { BackIcon } from '@/shared/ui/icons';
import styles from './BlogWidget.module.scss';

export interface BlogPostWidgetProps {
  businessId: string;
  postSlug: string;
}

/**
 * `/site/[businessId]/blog/[postSlug]` — страница чтения одного поста. Тот
 * же принцип отдельного физического маршрута, что и у `BlogListWidget` (см.
 * её комментарий) — не через `WebsiteRenderer`/`WebsitePage`.
 *
 * `content` выводится через `white-space: pre-wrap` (см. `BlogWidget.
 * module.scss`, `.content`), не через построчную разбивку на `<p>` — тот же
 * приём, что уже используется блоком `richtext` в самом Website Builder
 * (`entities/website/blocks/typography`), и по той же причине: пост хранит
 * обычный текст с пустой строкой между абзацами, не HTML (см. комментарий
 * модели `BlogPost` на backend).
 */
export function BlogPostWidget({ businessId, postSlug }: BlogPostWidgetProps) {
  const siteFetcher = useCallback(() => getAnonymousPublicSite(businessId), [businessId]);
  const postFetcher = useCallback(
    () => getPublicBlogPostBySlug(businessId, postSlug),
    [businessId, postSlug],
  );
  const site = useAsyncData(siteFetcher);
  const post = useAsyncData(postFetcher);

  if (site.status === 'loading' || post.status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем пост…" />
      </div>
    );
  }

  if (site.status === 'error' || !site.data) {
    return (
      <div className={styles.status}>
        <ErrorState message={site.error} onRetry={site.refetch} />
      </div>
    );
  }

  if (!site.data.isPublished || !site.data.document) {
    return (
      <div className={styles.status}>
        <EmptyState title="Сайт недоступен" description="Владелец ещё не опубликовал этот сайт." />
      </div>
    );
  }

  if (post.status === 'error') {
    return (
      <div className={styles.status}>
        <ErrorState message={post.error} onRetry={post.refetch} />
      </div>
    );
  }

  const themeVars = buildThemeCssVars(site.data.document.theme) as CSSProperties;

  if (!post.data) {
    return (
      <ScrollArea className={styles.root} style={themeVars}>
        <div className={styles.page}>
          <Link href="/blog" className={styles.back}>
            <BackIcon />К блогу
          </Link>
          <EmptyState
            title="Пост не найден"
            description="Такого поста на этом сайте нет — проверьте адрес."
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className={styles.root} style={themeVars}>
      <article className={styles.page}>
        <Link href="/blog" className={styles.back}>
          <BackIcon />К блогу
        </Link>

        {post.data.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- превью загруженной обложки поста
          <img src={post.data.coverImage} alt="" className={styles.cover} />
        )}

        <span className={styles.date}>
          {new Date(post.data.createdAt).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
        <h1 className={styles.heading}>{post.data.title}</h1>
        <div className={styles.content}>{post.data.content}</div>
      </article>
    </ScrollArea>
  );
}
