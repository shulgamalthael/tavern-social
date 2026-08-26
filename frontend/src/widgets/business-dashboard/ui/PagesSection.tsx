'use client';

import Link from 'next/link';
import { useState } from 'react';
import { saveWebsiteDraft, type WebsiteDraft } from '@/entities/website';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { EditIcon, TrashIcon } from '@/shared/ui/icons';
import styles from './PagesSection.module.scss';

export interface PagesSectionProps {
  businessId: string;
  status: AsyncStatus;
  error: string | null;
  draft: WebsiteDraft | undefined;
  onRetry: () => void;
}

/**
 * Список страниц сайта — создание/переименование/реордер по-прежнему живут
 * только в билдере (`PagesPanel.tsx`, вкладка «Страницы»), дублировать эту
 * разметку здесь не нужно. Но удаление добавлено и сюда: владелец бизнеса не
 * обязан открывать полноценный билдер, чтобы убрать ненужную страницу — это
 * ровно то, для чего вообще нужен «единый центр управления» (см. корневой
 * комментарий `BusinessDashboardWidget.tsx`).
 *
 * Дашборд не подключён к Zustand-стору билдера (`useWebsiteBuilderStore`) —
 * он читает/пишет документ напрямую через тот же `saveWebsiteDraft`, что и
 * автосохранение билдера (см. `entities/website/model/use-autosave.ts`), а
 * не через стор: два независимых экрана, у каждого своя копия документа,
 * общий источник правды — только backend. После удаления перезапрашиваем
 * документ (`onRetry`), а не правим локальный кэш вручную — так экран
 * всегда показывает то, что реально сохранено, а не оптимистичное
 * предположение (см. AGENTS.md, «единственный источник истины»).
 */
export function PagesSection({ businessId, status, error, draft, onRetry }: PagesSectionProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем страницы…" />
      </div>
    );
  }

  if (status === 'error' || !draft) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  async function handleDelete(pageId: string) {
    if (!draft) return;
    setDeletingId(pageId);
    setDeleteError(null);
    try {
      const nextDocument = {
        ...draft.document,
        pages: draft.document.pages.filter((page) => page.id !== pageId),
      };
      await saveWebsiteDraft(businessId, nextDocument);
      onRetry();
    } catch {
      setDeleteError('Не удалось удалить страницу — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  return (
    <>
      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      <ul className={styles.list}>
        {draft.document.pages.map((page, index) => (
          <li key={page.id} className={styles.row}>
            <div className={styles.row__body}>
              <span className={styles.row__title}>{page.title}</span>
              <span className={styles.row__slug}>
                {index === 0 ? 'Главная — открывается по адресу сайта' : `/${page.slug}`}
              </span>
            </div>
            <span className={styles.row__count}>
              {page.blocks.length} {pluralizeRu(page.blocks.length, ['блок', 'блока', 'блоков'])}
            </span>
            {draft.document.pages.length > 1 && (
              <button
                type="button"
                className={styles.row__delete}
                aria-label={`Удалить страницу «${page.title}»`}
                disabled={deletingId === page.id}
                onClick={() => setConfirmTarget({ id: page.id, title: page.title })}
              >
                <TrashIcon />
              </button>
            )}
          </li>
        ))}

        <li>
          <Link href={`/business/${businessId}/edit`} className={styles.editAllLink}>
            <EditIcon />
            Управлять страницами в конструкторе
          </Link>
        </li>
      </ul>

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить страницу «{confirmTarget.title}» вместе со всем её содержимым? Это необратимо
              — в отличие от билдера, у дашборда нет «Отменить».
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
                onClick={() => void handleDelete(confirmTarget.id)}
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
