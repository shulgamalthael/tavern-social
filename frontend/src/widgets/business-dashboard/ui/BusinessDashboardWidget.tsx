'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { getBusiness } from '@/entities/business';
import { getWebsiteDraft, publishWebsite } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import {
  BackIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  CpuIcon,
  DatabaseIcon,
  EditIcon,
  ExternalLinkIcon,
  FileIcon,
  GridIcon,
  MailIcon,
  NewspaperIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  WalletIcon,
} from '@/shared/ui/icons';
import { AppointmentsSection } from './AppointmentsSection';
import { BlogSection } from './BlogSection';
import { CustomEntitiesSection } from './CustomEntitiesSection';
import { DiscountsSection } from './DiscountsSection';
import { FormsSection } from './FormsSection';
import { OrdersSection } from './OrdersSection';
import { OverviewSection } from './OverviewSection';
import { PagesSection } from './PagesSection';
import { ProductsSection } from './ProductsSection';
import { RulesSection } from './RulesSection';
import { ServicesSection } from './ServicesSection';
import { Web3Section } from './Web3Section';
import { WidgetsSection } from './WidgetsSection';
import styles from './BusinessDashboardWidget.module.scss';

export interface BusinessDashboardWidgetProps {
  businessId: string;
}

type DashboardTab =
  | 'overview'
  | 'pages'
  | 'products'
  | 'orders'
  | 'discounts'
  | 'services'
  | 'appointments'
  | 'blog'
  | 'forms'
  | 'rules'
  | 'widgets'
  | 'web3'
  | 'custom-entities';

const IN_PAGE_TABS: { id: DashboardTab; icon: typeof ChartIcon; label: string }[] = [
  { id: 'overview', icon: ChartIcon, label: 'Обзор' },
  { id: 'pages', icon: FileIcon, label: 'Страницы' },
  { id: 'products', icon: ShoppingBagIcon, label: 'Товары' },
  { id: 'orders', icon: ReceiptIcon, label: 'Заказы' },
  { id: 'discounts', icon: TagIcon, label: 'Скидки' },
  { id: 'services', icon: ClockIcon, label: 'Услуги' },
  { id: 'appointments', icon: CalendarIcon, label: 'Записи' },
  { id: 'blog', icon: NewspaperIcon, label: 'Блог' },
  { id: 'forms', icon: MailIcon, label: 'Заявки' },
  { id: 'widgets', icon: GridIcon, label: 'Виджеты' },
  { id: 'rules', icon: CpuIcon, label: 'Автоматизация' },
  { id: 'web3', icon: WalletIcon, label: 'Web3' },
  { id: 'custom-entities', icon: DatabaseIcon, label: 'База данных' },
];

/**
 * Единый центр управления бизнесом — раньше управление было разбросано по
 * `/business/[id]` (соцсеть-профиль), `/business/[id]/edit` (билдер) и
 * `/business/[id]/settings` (домены/метаданные) без единой точки входа (см.
 * ROADMAP.md, Phase 0 — «нет Business Dashboard вообще»). Сюда НЕ переносится
 * содержимое тех экранов — только сводка и ссылки на них: «Настройки» и
 * «Конструктор» слишком самостоятельны, чтобы дублировать их разметку здесь.
 *
 * «Товары»/«Заказы»/«Скидки» (Commerce, Phase 5+17), «Услуги»/«Записи»
 * (Booking, Phase 6) и «Блог» (Content, Phase 7, см. ROADMAP.md §8) —
 * capability-специфичные вкладки. «Скидки» гейтится той же `commerce`
 * капабилити, что «Товары» (см. `DiscountsSection`) — у Booking своего
 * ценового движка нет, см. `PRICING_ARCHITECTURE.md` §8. «Товары»/«Услуги»/
 * «Блог» показаны ВСЕГДА, а не только когда
 * капабилити уже включена — секции сами решают, показать список или
 * предложение включить капабилити (см. комментарии `ProductsSection`/
 * `ServicesSection`/`BlogSection`): прятать вкладку до включения было бы
 * курицей-и-яйцом — включить капабилити неоткуда, если пункт меню, ведущий
 * к этому включению, сам скрыт, пока капабилити не включена. «Заказы»/
 * «Записи» тоже не гейтятся — история уже оформленных заказов/записей
 * должна остаться видимой, даже если капабилити потом выключили (см.
 * комментарии `OrdersSection`/`AppointmentsSection`). У «Блога» такой
 * симметричной вкладки-истории нет — опубликованный пост просто виден,
 * снятый с публикации просто не виден, тут нечего хранить отдельно от
 * самого поста.
 *
 * «Заявки» (Forms, Phase 9) — не capability-специфичная вкладка вообще:
 * формы (`contactform`/`newsletterform`/`simpleform`) доступны любому
 * бизнесу без включения какой-либо `Business.capabilities` (см.
 * комментарий модели `FormSubmission` в backend schema.prisma), поэтому
 * `FormsSection` не показывает экран "включить капабилити" — сразу список
 * заявок или пустое состояние.
 *
 * «Автоматизация» (Business Logic Engine v1, AI_PLATFORM_ROADMAP.md §2.5/
 * §13/§15) — тоже без гейта капабилити, тот же принцип, что у «Заявок»:
 * правило ссылается на поля конкретного события (заказ/запись/форма), но
 * само создание правила не требует включённой `commerce`/`booking`.
 *
 * «Виджеты» (Custom Widget Engine v1, AI_PLATFORM_ROADMAP.md §2.4/§14/§16.2)
 * — тот же принцип, что у «Автоматизации»: composition блоков не завязана
 * ни на одну капабилити. Виджет пока нигде не встраивается на реальные
 * страницы сайта (см. `WidgetsSection`'s комментарий) — вкладка позволяет
 * только создавать/редактировать сохранённые композиции блоков впрок.
 *
 * «Web3» (AI_PLATFORM_ROADMAP.md §2.6, AI-7 первый ограниченный слайс) —
 * тоже без гейта капабилити: read-only витрина баланса/NFT кошелька,
 * который владелец сам указал для бизнеса (`Business.web3WalletAddress`),
 * не приём платежей от покупателей (см. `Web3Section`'s комментарий).
 *
 * «База данных» (AI_PLATFORM_ROADMAP.md §2.2/§19, AI-8 первый ограниченный
 * слайс) — тоже без гейта капабилити: владелец-CRUD пользовательских
 * сущностей ("Клиенты CRM" и т.п.) поверх декларативной EAV-модели, не
 * произвольная схема с реальными DDL-миграциями (см. `CustomEntitiesSection`'s
 * комментарий).
 */
export function BusinessDashboardWidget({ businessId }: BusinessDashboardWidgetProps) {
  const businessFetcher = useCallback(() => getBusiness(businessId), [businessId]);
  const draftFetcher = useCallback(() => getWebsiteDraft(businessId), [businessId]);
  const business = useAsyncData(businessFetcher);
  const draft = useAsyncData(draftFetcher);

  const [tab, setTab] = useState<DashboardTab>('overview');
  const [isPublishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await publishWebsite(businessId);
      await business.refetch();
    } catch {
      setPublishError('Не удалось опубликовать сайт — попробуйте ещё раз');
    } finally {
      setPublishing(false);
    }
  }

  if (business.status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем бизнес…" />
      </div>
    );
  }

  if (business.status === 'error' || !business.data) {
    return (
      <div className={styles.status}>
        <ErrorState message={business.error} onRetry={business.refetch} />
      </div>
    );
  }

  const data = business.data;

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <Link href={`/business/${businessId}`} className={styles.back} aria-label="Назад к бизнесу">
          <BackIcon />
        </Link>
        <Avatar size="sm" initials={data.name.slice(0, 2).toUpperCase()} src={data.logoUrl} />
        <div className={styles.bar__titles}>
          <h1 className={styles.bar__name}>{data.name}</h1>
          <span
            className={cn(styles.badge, data.status === 'published' && styles['badge--published'])}
          >
            {data.status === 'published' ? 'Опубликован' : 'Черновик'}
          </span>
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.nav} aria-label="Разделы дашборда">
          {IN_PAGE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(styles.nav__item, tab === item.id && styles['nav__item--active'])}
              onClick={() => setTab(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}

          <div className={styles.nav__divider} />

          <Link href={`/business/${businessId}/edit`} className={styles.nav__item}>
            <EditIcon />
            Конструктор
          </Link>
          <Link href={`/business/${businessId}/settings`} className={styles.nav__item}>
            <SettingsIcon />
            Настройки
          </Link>
          <Link href={`/business/${businessId}`} target="_blank" className={styles.nav__item}>
            <ExternalLinkIcon />
            Открыть сайт
          </Link>
        </nav>

        <div className={styles.content}>
          {tab === 'overview' && (
            <OverviewSection
              business={data}
              pageCount={draft.data?.document.pages.length}
              isPublishing={isPublishing}
              publishError={publishError}
              onPublish={() => void handlePublish()}
            />
          )}
          {tab === 'pages' && (
            <PagesSection
              businessId={businessId}
              status={draft.status}
              error={draft.error}
              draft={draft.data}
              onRetry={draft.refetch}
            />
          )}
          {tab === 'products' && (
            <ProductsSection business={data} onCapabilityEnabled={() => void business.refetch()} />
          )}
          {tab === 'orders' && <OrdersSection businessId={businessId} />}
          {tab === 'discounts' && (
            <DiscountsSection business={data} onCapabilityEnabled={() => void business.refetch()} />
          )}
          {tab === 'services' && (
            <ServicesSection business={data} onCapabilityEnabled={() => void business.refetch()} />
          )}
          {tab === 'appointments' && <AppointmentsSection businessId={businessId} />}
          {tab === 'blog' && (
            <BlogSection business={data} onCapabilityEnabled={() => void business.refetch()} />
          )}
          {tab === 'forms' && <FormsSection businessId={businessId} />}
          {tab === 'rules' && <RulesSection businessId={businessId} />}
          {tab === 'widgets' && <WidgetsSection businessId={businessId} />}
          {tab === 'web3' && (
            <Web3Section business={data} onWalletChanged={() => void business.refetch()} />
          )}
          {tab === 'custom-entities' && <CustomEntitiesSection businessId={businessId} />}
        </div>
      </div>
    </div>
  );
}
