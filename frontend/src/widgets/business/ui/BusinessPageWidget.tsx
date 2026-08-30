'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { CartWidget } from '@/entities/cart';
import { getBusiness, type Business } from '@/entities/business';
import {
  WebsiteRenderer,
  getPublicWebsite,
  useRealViewport,
  type BlockBusinessContext,
  type PublicWebsite,
} from '@/entities/website';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { BackIcon, ChartIcon, EditIcon, SettingsIcon } from '@/shared/ui/icons';
import styles from './BusinessPageWidget.module.scss';

export interface BusinessPageWidgetProps {
  businessId: string;
}

interface PageData {
  publicWebsite: PublicWebsite;
  owned: Business | null;
}

function toBusinessContext(
  publicWebsite: PublicWebsite,
  owned: Business | null,
): BlockBusinessContext {
  if (owned) {
    return {
      businessId: owned.id,
      name: owned.name,
      logoUrl: owned.logoUrl,
      email: owned.email,
      phone: owned.phone,
      address: owned.address,
      socialLinks: owned.socialLinks,
    };
  }
  // Не владелец — backend отдаёт по-настоящему публичному эндпоинту только
  // минимальный профиль (см. `entities/website/api/get-public-website.ts`,
  // комментарий про то, что полноценный анонимный доступ — задача на
  // будущее): контакты/соцсети блоков `contact`/`footer`/`sociallinks`
  // для стороннего зрителя сейчас честно пустые, а не подставные.
  return {
    businessId: publicWebsite.business.id,
    name: publicWebsite.business.name,
    logoUrl: publicWebsite.business.logoUrl,
    email: null,
    phone: null,
    address: null,
    socialLinks: [],
  };
}

/**
 * `/business/[id]` — витрина одного бизнеса: для владельца это карточка
 * бизнеса с переходом в конструктор (`/business/[id]/edit`), для стороннего
 * зрителя — просто опубликованный сайт (если он есть) через тот же
 * `WebsiteRenderer`, что билдер и `PreviewModal` (см. корневой план фичи).
 * Владение определяется попыткой `getBusiness` (владелец-only на backend) —
 * успех значит «это мой бизнес», исключение здесь не ошибка загрузки, а
 * нормальный сигнал «я не владелец» (см. `fetcher` ниже).
 */
export function BusinessPageWidget({ businessId }: BusinessPageWidgetProps) {
  const fetcher = useCallback(async (): Promise<PageData> => {
    const publicWebsite = await getPublicWebsite(businessId);
    const owned = await getBusiness(businessId).catch(() => null);
    return { publicWebsite, owned };
  }, [businessId]);

  const { status, data, error, refetch } = useAsyncData(fetcher);
  const viewport = useRealViewport();

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем страницу бизнеса…" />
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

  const { publicWebsite, owned } = data;
  const displayName = owned?.name ?? publicWebsite.business.name;
  const businessContext = toBusinessContext(publicWebsite, owned);
  const document = publicWebsite.isPublished ? publicWebsite.document : null;
  const capabilities = owned?.capabilities ?? publicWebsite.business.capabilities;

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <Link href={owned ? '/businesses' : '/'} className={styles.back} aria-label="Назад">
          <BackIcon />
        </Link>

        <Avatar
          size="sm"
          initials={displayName.slice(0, 2).toUpperCase()}
          src={owned?.logoUrl ?? publicWebsite.business.logoUrl}
        />
        <span className={styles['bar__name']}>{displayName}</span>

        {!publicWebsite.isPublished && (
          <span className={styles['bar__badge']}>{owned ? 'Черновик' : 'Не опубликован'}</span>
        )}

        {owned && (
          <div className={styles.bar__actions}>
            <Link
              href={`/business/${businessId}/dashboard`}
              className={styles.settingsButton}
              aria-label="Дашборд бизнеса"
              title="Дашборд"
            >
              <ChartIcon />
            </Link>
            <Link
              href={`/business/${businessId}/settings`}
              className={styles.settingsButton}
              aria-label="Настройки бизнеса"
            >
              <SettingsIcon />
            </Link>
            <Link href={`/business/${businessId}/edit`} className={styles.editButton}>
              <EditIcon />
              Редактировать
            </Link>
          </div>
        )}
      </header>

      {document ? (
        <ScrollArea className={styles.siteScroll} viewportClassName={styles.siteViewport}>
          <WebsiteRenderer
            page={document.pages[0]}
            pages={document.pages}
            theme={document.theme}
            viewport={viewport}
            business={businessContext}
          />
          {capabilities.includes('commerce') && (
            <CartWidget businessId={businessContext.businessId} />
          )}
        </ScrollArea>
      ) : (
        <div className={styles.empty}>
          <EmptyState
            title={owned ? 'Сайт ещё не опубликован' : 'Сайт недоступен'}
            description={
              owned
                ? 'Соберите сайт в конструкторе и опубликуйте его — тогда он появится здесь.'
                : 'Владелец ещё не опубликовал сайт этого бизнеса.'
            }
            action={
              owned && (
                <Link href={`/business/${businessId}/edit`} className={styles.emptyAction}>
                  <EditIcon />
                  Открыть конструктор
                </Link>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
