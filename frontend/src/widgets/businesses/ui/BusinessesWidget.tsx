'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  BusinessCard,
  BusinessCardSkeleton,
  deleteBusiness,
  duplicateBusiness,
  getBusinesses,
  type Business,
} from '@/entities/business';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { BackIcon, PlusIcon } from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './BusinessesWidget.module.scss';

const SKELETON_COUNT = 6;

/**
 * Дашборд `/businesses` — отдельный маршрут (не раздел SPA, см. `widgets/
 * navigation-dock/ui/NavigationDock.tsx`, пункт «Бизнесы»), поэтому своя
 * шапка со ссылкой назад в саму Таверну, без общего `Header`/`NavigationDock`
 * из `HomeApp` — тот же приём, что и у `/admin` (`widgets/admin/ui/
 * AdminWidget.tsx`). Список бизнесов текущего пользователя, создание нового
 * (`/businesses/new`), дублирование и удаление прямо с карточки.
 */
export function BusinessesWidget() {
  const router = useRouter();
  const { status, data, error, refetch } = useAsyncData(getBusinesses);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    kind: 'duplicate' | 'delete';
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = businesses ?? data ?? [];

  async function handleDuplicate(businessId: string) {
    setPendingAction({ id: businessId, kind: 'duplicate' });
    setActionError(null);
    try {
      const copy = await duplicateBusiness(businessId);
      setBusinesses([...list, copy]);
    } catch (duplicateError) {
      setActionError(
        duplicateError instanceof Error ? duplicateError.message : 'Не удалось дублировать бизнес',
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPendingAction({ id: deleteTarget.id, kind: 'delete' });
    setActionError(null);
    try {
      await deleteBusiness(deleteTarget.id);
      setBusinesses(list.filter((business) => business.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : 'Не удалось удалить бизнес',
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <SectionContainer className={styles.section}>
      <div className={styles.top}>
        <Link href="/" className={styles.back} aria-label="Назад в Таверну">
          <BackIcon />
        </Link>
        <PageHead title="Бизнесы" description="Сайты для ваших дел — по одному на каждый бизнес" />
        <Button className={styles.create} onClick={() => router.push('/businesses/new')}>
          <PlusIcon />
          Новый бизнес
        </Button>
      </div>

      {actionError && (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      )}

      {status === 'loading' && (
        <div className={styles.grid}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <BusinessCardSkeleton key={index} />
          ))}
        </div>
      )}

      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && list.length === 0 && (
        <EmptyState
          title="Пока нет ни одного бизнеса"
          description="Создайте первый бизнес, чтобы собрать для него сайт — в конструкторе с готовыми блоками."
          action={
            <Button onClick={() => router.push('/businesses/new')}>
              <PlusIcon />
              Создать бизнес
            </Button>
          }
        />
      )}

      {status === 'success' && list.length > 0 && (
        <div className={styles.grid}>
          {list.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onOpen={(businessId) => router.push(`/business/${businessId}`)}
              onDuplicate={handleDuplicate}
              onDelete={() => setDeleteTarget(business)}
              isDuplicating={
                pendingAction?.id === business.id && pendingAction.kind === 'duplicate'
              }
              isDeleting={pendingAction?.id === business.id && pendingAction.kind === 'delete'}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)} label="Удалить бизнес">
          <div className={styles.modal}>
            <h2>Удалить «{deleteTarget.name}»?</h2>
            <p className={styles['modal__hint']}>
              Необратимо: бизнес и его сайт (черновик и опубликованная версия) удалятся навсегда.
            </p>
            <div className={styles['modal__actions']}>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Отмена
              </Button>
              <Button
                className={styles['modal__danger']}
                onClick={() => void confirmDelete()}
                disabled={pendingAction?.id === deleteTarget.id}
              >
                Удалить
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </SectionContainer>
  );
}
