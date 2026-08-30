'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { getBusiness } from '@/entities/business';
import {
  deleteDomain,
  getDomains,
  setPrimaryDomain,
  verifyDomain,
  type ConnectDomainResult,
  type Domain,
} from '@/entities/domain';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import { BackIcon, PlusIcon } from '@/shared/ui/icons';
import { BusinessCurrencySection } from './BusinessCurrencySection';
import { BusinessSeoSection } from './BusinessSeoSection';
import { BusinessWorkingHoursSection } from './BusinessWorkingHoursSection';
import { ConnectDomainModal } from './ConnectDomainModal';
import { DomainRow } from './DomainRow';
import styles from './BusinessSettingsWidget.module.scss';

type PendingAction = { id: string; kind: 'verify' | 'primary' | 'delete' };

export interface BusinessSettingsWidgetProps {
  businessId: string;
}

/**
 * `/business/[id]/settings` — три раздела: валюта и платежи (`Business.
 * currency`, см. `BusinessCurrencySection.tsx` и ROADMAP.md §8 Currency
 * System), SEO по умолчанию (`Business.seoTitle`/`seoDescription`, см.
 * `BusinessSeoSection.tsx` и ROADMAP.md §3.11/§8 Phase 10) и домены (см.
 * корневой план задачи «multi-tenant domains», раздел «Domain Settings
 * UI»). Отдельный маршрут, не вкладка билдера — ни одно из этого не
 * специфично для одной страницы сайта и не должно требовать открытого
 * билдера, тот же принцип разделения, что и у `/business/[id]` (просмотр)
 * vs `/business/[id]/edit` (билдер).
 */
export function BusinessSettingsWidget({ businessId }: BusinessSettingsWidgetProps) {
  const businessFetcher = useCallback(() => getBusiness(businessId), [businessId]);
  const domainsFetcher = useCallback(() => getDomains(businessId), [businessId]);

  const business = useAsyncData(businessFetcher);
  const domainsQuery = useAsyncData(domainsFetcher);

  const [domains, setDomains] = useState<Domain[] | null>(null);
  const list = domains ?? domainsQuery.data ?? [];

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConnectOpen, setConnectOpen] = useState(false);
  const [justConnected, setJustConnected] = useState<ConnectDomainResult | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);

  async function handleVerify(domainId: string) {
    setPendingAction({ id: domainId, kind: 'verify' });
    setActionError(null);
    try {
      const updated = await verifyDomain(businessId, domainId);
      setDomains(list.map((item) => (item.id === domainId ? updated : item)));
      if (!updated.isVerified) {
        setActionError(
          'DNS ещё не настроен — проверьте запись и попробуйте снова через несколько минут.',
        );
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось проверить домен');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSetPrimary(domainId: string) {
    setPendingAction({ id: domainId, kind: 'primary' });
    setActionError(null);
    try {
      setDomains(await setPrimaryDomain(businessId, domainId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось изменить основной домен');
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPendingAction({ id: deleteTarget.id, kind: 'delete' });
    setActionError(null);
    try {
      setDomains(await deleteDomain(businessId, deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось удалить домен');
    } finally {
      setPendingAction(null);
    }
  }

  function handleConnected(result: ConnectDomainResult) {
    setDomains([...list, result.domain]);
    setJustConnected(result);
    setConnectOpen(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.top}>
        <Link href={`/business/${businessId}`} className={styles.back} aria-label="Назад к бизнесу">
          <BackIcon />
        </Link>
        <div>
          <h1 className={styles.title}>Настройки</h1>
          <p className={styles.subtitle}>
            {business.status === 'success' ? business.data?.name : 'Загрузка…'}
          </p>
        </div>
      </div>

      {business.status === 'success' && business.data && (
        <BusinessCurrencySection business={business.data} onSaved={() => void business.refetch()} />
      )}

      {business.status === 'success' && business.data && (
        <BusinessSeoSection business={business.data} onSaved={() => void business.refetch()} />
      )}

      {business.status === 'success' &&
        business.data &&
        business.data.capabilities.includes('booking') && (
          <BusinessWorkingHoursSection
            business={business.data}
            onSaved={() => void business.refetch()}
          />
        )}

      <section className={styles.section}>
        <div className={styles['section__head']}>
          <div>
            <h2 className={styles['section__title']}>Домены</h2>
            <p className={styles['section__hint']}>Адреса, по которым открывается ваш сайт.</p>
          </div>
          <Button onClick={() => setConnectOpen(true)}>
            <PlusIcon />
            Подключить домен
          </Button>
        </div>

        {actionError && (
          <p className={styles.error} role="alert">
            {actionError}
          </p>
        )}

        {domainsQuery.status === 'loading' && (
          <div className={styles.status}>
            <Loader label="Загружаем домены…" />
          </div>
        )}

        {domainsQuery.status === 'error' && (
          <ErrorState message={domainsQuery.error} onRetry={domainsQuery.refetch} />
        )}

        {domainsQuery.status === 'success' && list.length === 0 && (
          <EmptyState
            title="Пока нет доменов"
            description="Что-то пошло не так — попробуйте обновить страницу."
          />
        )}

        {domainsQuery.status === 'success' && list.length > 0 && (
          <ul className={styles.list}>
            {list.map((domain) => (
              <DomainRow
                key={domain.id}
                businessId={businessId}
                domain={domain}
                isPending={pendingAction?.id === domain.id}
                initialInstructions={
                  justConnected?.domain.id === domain.id ? justConnected.instructions : undefined
                }
                onVerify={(id) => void handleVerify(id)}
                onSetPrimary={(id) => void handleSetPrimary(id)}
                onDelete={() => setDeleteTarget(domain)}
              />
            ))}
          </ul>
        )}
      </section>

      {isConnectOpen && (
        <ConnectDomainModal
          businessId={businessId}
          onConnected={handleConnected}
          onClose={() => setConnectOpen(false)}
        />
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} label="Удалить домен">
          <div className={styles.confirm}>
            <h2>Удалить «{deleteTarget.hostname}»?</h2>
            <p className={styles['confirm__hint']}>
              Сайт перестанет открываться по этому адресу. Действие необратимо.
            </p>
            <div className={styles['confirm__actions']}>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Отмена
              </Button>
              <Button
                className={styles['confirm__danger']}
                onClick={() => void confirmDelete()}
                disabled={pendingAction?.id === deleteTarget.id}
              >
                Удалить
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
