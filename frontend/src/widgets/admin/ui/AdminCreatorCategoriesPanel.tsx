'use client';

import { useState } from 'react';
import {
  createCreatorCategory,
  deleteCreatorCategory,
  listAdminCreatorCategories,
  updateCreatorCategory,
  type AdminCreatorCategory,
} from '@/entities/admin';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './AdminCreatorCategoriesPanel.module.scss';

interface CategoryFormValue {
  slug: string;
  label: string;
  icon: string;
  parentId: string;
  order: string;
}

const EMPTY_FORM: CategoryFormValue = { slug: '', label: '', icon: '', parentId: '', order: '0' };

function toFormValue(category: AdminCreatorCategory): CategoryFormValue {
  return {
    slug: category.slug,
    label: category.label,
    icon: category.icon ?? '',
    parentId: category.parentId ?? '',
    order: String(category.order),
  };
}

interface CategoryFormProps {
  value: CategoryFormValue;
  onChange: (value: CategoryFormValue) => void;
  parentOptions: AdminCreatorCategory[];
  excludeParentId?: string;
}

function CategoryForm({ value, onChange, parentOptions, excludeParentId }: CategoryFormProps) {
  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>Название</span>
        <input
          type="text"
          className={styles.input}
          value={value.label}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Slug</span>
        <input
          type="text"
          className={styles.input}
          value={value.slug}
          onChange={(event) => onChange({ ...value, slug: event.target.value })}
          placeholder="game-development"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Иконка (эмодзи)</span>
        <input
          type="text"
          className={styles.input}
          value={value.icon}
          onChange={(event) => onChange({ ...value, icon: event.target.value })}
          placeholder="🎮"
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Родительская категория</span>
        <select
          className={styles.input}
          value={value.parentId}
          onChange={(event) => onChange({ ...value, parentId: event.target.value })}
        >
          <option value="">— нет (верхний уровень) —</option>
          {parentOptions
            .filter((option) => option.id !== excludeParentId)
            .map((option) => (
              <option key={option.id} value={option.id}>
                {'—'.repeat(option.depth)} {option.label}
              </option>
            ))}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Порядок</span>
        <input
          type="number"
          className={styles.input}
          value={value.order}
          onChange={(event) => onChange({ ...value, order: event.target.value })}
        />
      </label>
    </div>
  );
}

interface CategoryRowProps {
  category: AdminCreatorCategory;
  allCategories: AdminCreatorCategory[];
  onChanged: () => void;
}

function CategoryRow({ category, allCategories, onChanged }: CategoryRowProps) {
  const [isEditing, setEditing] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [value, setValue] = useState<CategoryFormValue>(() => toFormValue(category));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await updateCreatorCategory(category.id, {
        slug: value.slug.trim(),
        label: value.label.trim(),
        icon: value.icon.trim(),
        parentId: value.parentId,
        order: Number(value.order) || 0,
      });
      setEditing(false);
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteCreatorCategory(category.id);
      setDeleting(false);
      onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось удалить');
      setBusy(false);
    }
  }

  if (isEditing) {
    return (
      <div className={styles.row} style={{ paddingLeft: category.depth * 20 }}>
        <CategoryForm
          value={value}
          onChange={setValue}
          parentOptions={allCategories}
          excludeParentId={category.id}
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.rowActions}>
          <Button variant="outline" disabled={busy} onClick={() => setEditing(false)}>
            Отмена
          </Button>
          <Button disabled={busy} onClick={() => void handleSave()}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row} style={{ paddingLeft: category.depth * 20 }}>
      <span className={styles.rowIcon}>{category.icon}</span>
      <span className={styles.rowLabel}>{category.label}</span>
      <span className={styles.rowSlug}>{category.slug}</span>
      <div className={styles.rowActions}>
        <Button variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
          Изменить
        </Button>
        <Button
          variant="ghost"
          className={styles.rowDanger}
          disabled={busy}
          onClick={() => setDeleting(true)}
        >
          Удалить
        </Button>
      </div>

      {error && !isDeleting && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isDeleting && (
        <Modal onClose={() => setDeleting(false)} label={`Удалить категорию ${category.label}`}>
          <div className={styles.modalBody}>
            <h2>Удалить категорию «{category.label}»?</h2>
            <p className={styles.hint}>
              Creator&rsquo;ы, у которых выбрана эта категория, потеряют этот тег. Категорию с
              подкатегориями удалить нельзя — сначала перенесите или удалите их.
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.rowActions}>
              <Button variant="outline" onClick={() => setDeleting(false)}>
                Отмена
              </Button>
              <Button
                className={styles.rowDanger}
                disabled={busy}
                onClick={() => void handleDelete()}
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

/**
 * Admin CRUD над иерархической таксономией `CreatorCategory` (Creator
 * Monetization §84) — изначально сидировалась один раз без редактирования
 * (§79's "отложенный nice-to-have"). Плоский DFS-список с отступом по
 * `depth` (backend `CreatorCategoriesService.listFlatForAdmin`), не
 * рекурсивное дерево компонентов — таксономия небольшая (десятки строк),
 * усложнять рендер ради общего случая незачем.
 */
export function AdminCreatorCategoriesPanel() {
  const { status, data, error, refetch } = useAsyncData(listAdminCreatorCategories);
  const [isCreating, setCreating] = useState(false);
  const [createValue, setCreateValue] = useState<CategoryFormValue>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  async function handleCreate() {
    setCreateBusy(true);
    setCreateError(null);
    try {
      await createCreatorCategory({
        slug: createValue.slug.trim(),
        label: createValue.label.trim(),
        icon: createValue.icon.trim() || undefined,
        parentId: createValue.parentId || undefined,
        order: Number(createValue.order) || 0,
      });
      setCreateValue(EMPTY_FORM);
      setCreating(false);
      refetch();
    } catch (submitError) {
      setCreateError(submitError instanceof Error ? submitError.message : 'Не удалось создать');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Категории creator&rsquo;ов</h3>
        {!isCreating && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            Добавить категорию
          </Button>
        )}
      </div>
      <p className={styles.hint}>
        Иерархическая таксономия деятельности creator&rsquo;а — используется при онбординге и в
        подборе рекламных кампаний.
      </p>

      {isCreating && (
        <div className={styles.createBlock}>
          <CategoryForm value={createValue} onChange={setCreateValue} parentOptions={data ?? []} />
          {createError && (
            <p className={styles.error} role="alert">
              {createError}
            </p>
          )}
          <div className={styles.rowActions}>
            <Button
              variant="outline"
              disabled={createBusy}
              onClick={() => {
                setCreating(false);
                setCreateValue(EMPTY_FORM);
                setCreateError(null);
              }}
            >
              Отмена
            </Button>
            <Button disabled={createBusy} onClick={() => void handleCreate()}>
              {createBusy ? 'Создаём…' : 'Создать'}
            </Button>
          </div>
        </div>
      )}

      {status === 'loading' && <Loader label="Загружаем категории…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' && data && (
        <div className={styles.list}>
          {data.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              allCategories={data}
              onChanged={refetch}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
