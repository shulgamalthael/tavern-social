'use client';

import { useCallback, useState } from 'react';
import {
  deleteFormSubmission,
  getFormSubmissions,
  type FormSubmission,
} from '@/entities/form-submission';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { TrashIcon } from '@/shared/ui/icons';
import styles from './FormsSection.module.scss';

export interface FormsSectionProps {
  businessId: string;
}

const FORM_TYPE_LABELS: Record<string, string> = {
  contactform: 'Обратная связь',
  newsletterform: 'Подписка',
  simpleform: 'Заявка',
};

/**
 * Единственная секция Dashboard, не завязанная ни на одну капабилити (см.
 * комментарий модели `FormSubmission` в backend schema.prisma) — вкладка
 * видна всегда, без экрана "включить капабилити" (в отличие от `Products
 * Section`/`ServicesSection`/`BlogSection`), потому что включать нечего:
 * формы (`contactform`/`newsletterform`/`simpleform`) уже доступны в
 * Component Library любому бизнесу. Заявки только читаются/удаляются —
 * ни редактирования, ни статусов (в отличие от `Orders`/`Appointments`,
 * заявка с формы не проходит через жизненный цикл, просто пришла или нет).
 */
export function FormsSection({ businessId }: FormsSectionProps) {
  const fetcher = useCallback(() => getFormSubmissions(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [confirmTarget, setConfirmTarget] = useState<FormSubmission | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(submission: FormSubmission) {
    setDeletingId(submission.id);
    setDeleteError(null);
    try {
      await deleteFormSubmission(businessId, submission.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить заявку — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем заявки…" />
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

  if (data.length === 0) {
    return (
      <EmptyState
        title="Пока нет заявок"
        description="Заявки появятся здесь, как только посетитель отправит форму на сайте — добавьте блок «Форма обратной связи» в конструкторе, если его ещё нет."
      />
    );
  }

  return (
    <>
      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      <ul className={styles.list}>
        {data.map((submission) => (
          <li key={submission.id} className={styles.card}>
            <div className={styles.card__header}>
              <div>
                <span className={styles.label}>{submission.formLabel}</span>
                <span className={styles.date}>
                  {new Date(submission.createdAt).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className={styles.headerActions}>
                <span className={styles.typeBadge}>
                  {FORM_TYPE_LABELS[submission.formType] ?? submission.formType}
                </span>
                <button
                  type="button"
                  className={styles.deleteButton}
                  aria-label="Удалить заявку"
                  disabled={deletingId === submission.id}
                  onClick={() => setConfirmTarget(submission)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>

            <div className={styles.items}>
              {Object.entries(submission.data).map(([label, value]) => (
                <div key={label} className={styles.item}>
                  <span className={styles['item__label']}>{label}</span>
                  <span className={styles['item__value']}>{value}</span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить заявку «{confirmTarget.formLabel}»? Это необратимо.
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
