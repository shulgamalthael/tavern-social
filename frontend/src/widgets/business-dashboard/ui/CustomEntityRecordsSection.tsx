'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import {
  deleteCustomEntityRecord,
  getCustomEntityRecords,
  type CustomEntity,
  type CustomEntityRecord,
} from '@/entities/custom-entity';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { BackIcon, PlusIcon } from '@/shared/ui/icons';
import { AddEntityFieldModal } from './AddEntityFieldModal';
import { CustomEntityRecordModal } from './CustomEntityRecordModal';
import styles from './CustomEntityRecordsSection.module.scss';
// Confirm-диалог удаления — та же разметка/стили, что у `ProductsSection`/
// `RulesSection` (`confirmOverlay`/`confirmCard*`), переиспользуем модуль
// вместо копирования (тот же приём, что `RulesSection`'s комментарий).
import sharedStyles from './ProductsSection.module.scss';

export interface CustomEntityRecordsSectionProps {
  businessId: string;
  entity: CustomEntity;
  onEntityChanged: (entity: CustomEntity) => void;
  onBack: () => void;
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (value === undefined || value === null) return '—';
  return String(value);
}

/**
 * Записи одной пользовательской сущности (AI_PLATFORM_ROADMAP.md §2.2/§19,
 * AI-8) — таблица, колонки которой ведутся из `entity.fields`, не хардкод.
 * Кнопка «Добавить поле» здесь же, не на экране списка сущностей — тот же
 * "поле имеет смысл менять там, где видны его данные" принцип, что у
 * `AddEntityFieldModal`'s подсказки уже занятых ключей.
 */
export function CustomEntityRecordsSection({
  businessId,
  entity,
  onEntityChanged,
  onBack,
}: CustomEntityRecordsSectionProps) {
  const fetcher = useCallback(
    () => getCustomEntityRecords(businessId, entity.id),
    [businessId, entity.id],
  );
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [editingRecord, setEditingRecord] = useState<CustomEntityRecord | null | 'new'>(null);
  const [isAddingField, setAddingField] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<CustomEntityRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(record: CustomEntityRecord) {
    setDeletingId(record.id);
    setDeleteError(null);
    try {
      await deleteCustomEntityRecord(businessId, entity.id, record.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить запись — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label="К списку сущностей"
        >
          <BackIcon />
        </button>
        <h3 className={styles.title}>{entity.name}</h3>
        <Button variant="outline" onClick={() => setAddingField(true)}>
          <PlusIcon />
          Поле
        </Button>
        <Button onClick={() => setEditingRecord('new')}>
          <PlusIcon />
          Запись
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {status === 'loading' && (
        <div className={styles.status}>
          <Loader label="Загружаем записи…" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles.status}>
          <ErrorState message={error} onRetry={refetch} />
        </div>
      )}

      {status === 'success' && data && data.length === 0 && (
        <EmptyState
          title="Пока нет ни одной записи"
          description="Добавьте первую запись — форма построена из полей этой сущности."
        />
      )}

      {status === 'success' && data && data.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {entity.fields.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {data.map((record) => (
                <tr key={record.id}>
                  {entity.fields.map((field) => (
                    <td key={field.key}>{formatValue(record.data[field.key])}</td>
                  ))}
                  <td className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.rowActions__button}
                      onClick={() => setEditingRecord(record)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className={cn(
                        styles.rowActions__button,
                        styles['rowActions__button--danger'],
                      )}
                      disabled={deletingId === record.id}
                      onClick={() => setConfirmTarget(record)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingRecord && (
        <CustomEntityRecordModal
          businessId={businessId}
          entity={entity}
          record={editingRecord === 'new' ? null : editingRecord}
          onSaved={() => {
            setEditingRecord(null);
            void refetch();
          }}
          onClose={() => setEditingRecord(null)}
        />
      )}

      {isAddingField && (
        <AddEntityFieldModal
          businessId={businessId}
          entity={entity}
          onSaved={(updated) => {
            setAddingField(false);
            onEntityChanged(updated);
          }}
          onClose={() => setAddingField(false)}
        />
      )}

      {confirmTarget && (
        <div className={sharedStyles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={sharedStyles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={sharedStyles.confirmCard__text}>Удалить эту запись? Это необратимо.</p>
            <div className={sharedStyles.confirmCard__actions}>
              <button
                type="button"
                className={sharedStyles.confirmCard__cancel}
                onClick={() => setConfirmTarget(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={sharedStyles.confirmCard__delete}
                disabled={deletingId === confirmTarget.id}
                onClick={() => void handleDelete(confirmTarget)}
              >
                {deletingId === confirmTarget.id ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
