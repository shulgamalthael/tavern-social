'use client';

import { useCallback } from 'react';
import { CartWidget } from '@/entities/cart';
import {
  WebsiteRenderer,
  getAnonymousPublicSite,
  pageHasHeaderCartButton,
  resolveSitePage,
  useRealViewport,
  type BlockBusinessContext,
} from '@/entities/website';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './PublicSiteWidget.module.scss';

export interface PublicSiteWidgetProps {
  businessId: string;
  /** Сегменты пути после `businessId` (см. `app/site/[businessId]/
   * [[...slug]]/page.tsx`) — `undefined`/`[]` для домашней страницы, иначе
   * ищем страницу документа с таким `slug` (см. `resolveSitePage`). */
  slug?: string[];
}

/**
 * Единственное, что рендерится на системном сабдомене/подключённом custom
 * domain (см. `proxy.ts`, `NextResponse.rewrite` на `/site/[businessId]`) —
 * никакого хрома Таверны, никакой кнопки «Редактировать», никакой ссылки на
 * билдер (см. корневой план задачи: «Edit mode никогда не должен быть
 * доступен через custom domain» / «не смешивай SaaS dashboard и customer
 * website на одном hostname»). Данные — через по-настоящему анонимный
 * `getAnonymousPublicSite` (без сессии Таверны вообще, см. её комментарий),
 * рендер — тот же `WebsiteRenderer`, что билдер и `PreviewModal`, поэтому
 * то, что видит настоящий посетитель, один в один совпадает с превью
 * владельца.
 */
export function PublicSiteWidget({ businessId, slug }: PublicSiteWidgetProps) {
  const fetcher = useCallback(() => getAnonymousPublicSite(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);
  const viewport = useRealViewport();

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем сайт…" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data.isPublished || !data.document) {
    return (
      <div className={styles.status}>
        <EmptyState title="Сайт недоступен" description="Владелец ещё не опубликовал этот сайт." />
      </div>
    );
  }

  const page = resolveSitePage(data.document, slug);
  if (!page) {
    return (
      <div className={styles.status}>
        <EmptyState
          title="Страница не найдена"
          description="Такой страницы на этом сайте нет — проверьте адрес."
        />
      </div>
    );
  }

  const businessContext: BlockBusinessContext = {
    businessId: data.business.id,
    name: data.business.name,
    logoUrl: data.business.logoUrl,
    email: null,
    phone: null,
    address: null,
    socialLinks: [],
  };

  return (
    <ScrollArea className={styles.root}>
      <WebsiteRenderer
        page={page}
        pages={data.document.pages}
        theme={data.document.theme}
        viewport={viewport}
        business={businessContext}
      />
      {data.business.capabilities.includes('commerce') && (
        <CartWidget businessId={data.business.id} hideFab={pageHasHeaderCartButton(page.blocks)} />
      )}
    </ScrollArea>
  );
}
