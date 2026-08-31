'use client';

import { useCallback, useState } from 'react';
import { deleteCustomWidget, getCustomWidgets, type CustomWidget } from '@/entities/custom-widget';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { EditIcon, GridIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { WidgetFormModal } from './WidgetFormModal';
// Разметка списка идентична `RulesSection`/`DiscountsSection` — переиспользуем
// тот же модуль стилей, тот же приём, что уже применён у обеих.
import styles from './ProductsSection.module.scss';

export interface WidgetsSectionProps {
  businessId: string;
}

/**
 * Custom Widget Engine v1 (AI_PLATFORM_ROADMAP.md §2.4/§14/§16.2) —
 * владелец-authoring UI поверх уже существующего owner-CRUD API (§14
 * сознательно отгрузил только API, без UI — тот же прецедент, что у AI-5's
 * первого слайса Rule engine). Не гейтится ни одной капабилити, тот же
 * принцип, что у `RulesSection`/`FormsSection`: композиция блоков не
 * привязана к `commerce`/`booking`.
 *
 * Виджет ЕЩЁ НИГДЕ не встраивается на реальную страницу сайта (см.
 * `CustomWidgetsService`'s комментарий про то, почему рендеринг/встраивание
 * — отдельная, отложенная работа) — статус «Черновик»/«Опубликован» сегодня
 * не имеет видимого эффекта на публичном сайте, это задел на будущее.
 */
export function WidgetsSection({ businessId }: WidgetsSectionProps) {
  const fetcher = useCallback(() => getCustomWidgets(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [editingWidget, setEditingWidget] = useState<CustomWidget | null | 'new'>(null);
  const [confirmTarget, setConfirmTarget] = useState<CustomWidget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(widget: CustomWidget) {
    setDeletingId(widget.id);
    setDeleteError(null);
    try {
      await deleteCustomWidget(businessId, widget.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить виджет — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем виджеты…" />
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
          Виджет — сохранённый набор блоков для повторного использования. Пока не встраивается на
          страницы сайта автоматически — это заготовка на будущее.
        </p>
        <Button onClick={() => setEditingWidget('new')}>
          <PlusIcon />
          Добавить виджет
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одного виджета"
          description="Например: набор блоков «Контакты» — заголовок, текст и адрес — который потом можно повторно использовать."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((widget) => (
            <li key={widget.id} className={styles.row}>
              <div className={styles['row__image']}>
                <GridIcon />
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>
                  {widget.name}
                  {widget.status === 'draft' && (
                    <span className={styles.row__hidden}>черновик</span>
                  )}
                </span>
                <span className={styles.row__meta}>
                  {widget.schema.length} {pluralizeBlocks(widget.schema.length)}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Редактировать «${widget.name}»`}
                onClick={() => setEditingWidget(widget)}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${widget.name}»`}
                disabled={deletingId === widget.id}
                onClick={() => setConfirmTarget(widget)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingWidget && (
        <WidgetFormModal
          businessId={businessId}
          widget={editingWidget === 'new' ? null : editingWidget}
          onSaved={() => {
            setEditingWidget(null);
            void refetch();
          }}
          onClose={() => setEditingWidget(null)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить виджет «{confirmTarget.name}»? Это необратимо.
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

function pluralizeBlocks(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'блок';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'блока';
  return 'блоков';
}
