'use client';

import Link from 'next/link';
import { useCallback, type CSSProperties } from 'react';
import { getPublicBlogPosts } from '@/entities/blog-post';
import { buildThemeCssVars, getAnonymousPublicSite } from '@/entities/website';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { BackIcon } from '@/shared/ui/icons';
import styles from './BlogWidget.module.scss';

export interface BlogListWidgetProps {
  businessId: string;
}

/**
 * `/site/[businessId]/blog` — список опубликованных постов. Отдельный
 * физический маршрут, не страница из `WebsitePage`/`WebsiteRenderer` (см.
 * ROADMAP.md §3.2/§8 Phase 7: полноценная система `PageType.system` с
 * реестром системных страниц НЕ построена в этом инкременте — строить её
 * ради одной-единственной капабилити было бы той же спекулятивной
 * инфраструктурой, от которой сознательно отказались раньше для
 * `Business.capabilities`/data-source полей, см. §8 Phase 3/4). Next.js сам
 * отдаёт приоритет этому статическому сегменту (`blog`) над catch-all
 * `[[...slug]]` на том же уровне — конфликта маршрутов нет, но если
 * когда-нибудь у бизнеса появится обычная страница сайта со slug `blog`,
 * она станет недостижима: известное, осознанное ограничение этого узкого
 * решения, не обобщённая система.
 *
 * Тема сайта (`buildThemeCssVars`) применяется к обёртке вручную — эта
 * страница не проходит через `WebsiteRenderer`, но должна выглядеть частью
 * того же сайта, а не самостоятельным «системным» экраном не в его стиле.
 */
export function BlogListWidget({ businessId }: BlogListWidgetProps) {
  const siteFetcher = useCallback(() => getAnonymousPublicSite(businessId), [businessId]);
  const postsFetcher = useCallback(() => getPublicBlogPosts(businessId), [businessId]);
  const site = useAsyncData(siteFetcher);
  const posts = useAsyncData(postsFetcher);

  if (site.status === 'loading' || posts.status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем блог…" />
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

  if (posts.status === 'error' || !posts.data) {
    return (
      <div className={styles.status}>
        <ErrorState message={posts.error} onRetry={posts.refetch} />
      </div>
    );
  }

  const themeVars = buildThemeCssVars(site.data.document.theme) as CSSProperties;

  return (
    <ScrollArea className={styles.root} style={themeVars}>
      <div className={styles.page}>
        <Link href="/" className={styles.back}>
          <BackIcon />
          На главную
        </Link>

        <h1 className={styles.heading}>Блог</h1>

        {posts.data.length === 0 ? (
          <EmptyState
            title="Пока нет постов"
            description="Загляните позже — здесь появятся новости."
          />
        ) : (
          <div className={styles.grid}>
            {posts.data.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className={styles.card}>
                {post.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element -- превью загруженной обложки поста
                  <img src={post.coverImage} alt="" className={styles['card__image']} />
                )}
                <div className={styles['card__body']}>
                  <span className={styles['card__date']}>
                    {new Date(post.createdAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  <h2 className={styles['card__title']}>{post.title}</h2>
                  {post.excerpt && <p className={styles['card__excerpt']}>{post.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
