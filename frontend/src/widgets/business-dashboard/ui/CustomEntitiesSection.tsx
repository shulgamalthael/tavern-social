'use client';

import { useCallback, useState } from 'react';
import { deleteCustomEntity, getCustomEntities, type CustomEntity } from '@/entities/custom-entity';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ChevronRightIcon, DatabaseIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { CustomEntityFormModal } from './CustomEntityFormModal';
import { CustomEntityRecordsSection } from './CustomEntityRecordsSection';
// Разметка списка идентична `DiscountsSection`/`RulesSection` (иконка/
// название/мета/действия в ряд) — переиспользуем тот же модуль стилей, тот
// же приём, что уже применён у них (см. `RulesSection`'s комментарий).
import styles from './ProductsSection.module.scss';

export interface CustomEntitiesSectionProps {
  businessId: string;
}

/**
 * Custom Database Builder v1 (AI_PLATFORM_ROADMAP.md §2.2/§19, AI-8 первый
 * ограниченный слайс) — владелец-CRUD пользовательских сущностей, тот же
 * принцип, что «Автоматизация»/«Виджеты»: не гейтится ни одной капабилити,
 * доступно любому бизнесу. Список сущностей → выбор одной показывает её
 * записи (`CustomEntityRecordsSection`) — тот же drill-down, что владелец
 * ожидает от "своей маленькой таблицы", не два независимых плоских списка.
 */
export function CustomEntitiesSection({ businessId }: CustomEntitiesSectionProps) {
  const fetcher = useCallback(() => getCustomEntities(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [selectedEntity, setSelectedEntity] = useState<CustomEntity | null>(null);
  const [isCreating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<CustomEntity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(entity: CustomEntity) {
    setDeletingId(entity.id);
    setDeleteError(null);
    try {
      await deleteCustomEntity(businessId, entity.id);
      if (selectedEntity?.id === entity.id) setSelectedEntity(null);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить сущность — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (selectedEntity) {
    return (
      <CustomEntityRecordsSection
        businessId={businessId}
        entity={selectedEntity}
        onEntityChanged={setSelectedEntity}
        onBack={() => setSelectedEntity(null)}
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем сущности…" />
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

  return (
    <>
      <div className={styles.header}>
        <p className={styles.hint}>
          Сущность — маленькая собственная «таблица» бизнеса за пределами Товаров/Услуг/Заказов,
          например «Клиенты CRM» или «Заявки на ремонт».
        </p>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon />
          Создать сущность
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одной сущности"
          description="Создайте первую, например «Клиенты CRM» с полями имя/телефон/статус."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((entity) => (
            <li key={entity.id} className={styles.row}>
              <div className={styles['row__image']}>
                <DatabaseIcon />
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>{entity.name}</span>
                <span className={styles.row__meta}>
                  {entity.fields.length} {entity.fields.length === 1 ? 'поле' : 'полей'}:{' '}
                  {entity.fields.map((field) => field.label).join(', ')}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Открыть «${entity.name}»`}
                onClick={() => setSelectedEntity(entity)}
              >
                <ChevronRightIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${entity.name}»`}
                disabled={deletingId === entity.id}
                onClick={() => setConfirmTarget(entity)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isCreating && (
        <CustomEntityFormModal
          businessId={businessId}
          onSaved={() => {
            setCreating(false);
            void refetch();
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить сущность «{confirmTarget.name}» вместе со всеми записями? Это необратимо.
            </p>
            <div className={styles.confirmCard__actions}>
              <button
                type="button"
                className={styles.confirmCard__cancel}
                onClick={() => setConfirmTarget(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmCard__delete}
                disabled={deletingId === confirmTarget.id}
                onClick={() => void handleDelete(confirmTarget)}
              >
                {deletingId === confirmTarget.id ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
