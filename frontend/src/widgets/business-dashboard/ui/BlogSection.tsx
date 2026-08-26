'use client';

import { useCallback, useState } from 'react';
import { updateBusiness, type Business } from '@/entities/business';
import { deleteBlogPost, getBlogPosts, type BlogPost } from '@/entities/blog-post';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { EditIcon, NewspaperIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { BlogPostFormModal } from './BlogPostFormModal';
import styles from './ProductsSection.module.scss';

export interface BlogSectionProps {
  business: Business;
  onCapabilityEnabled: () => void;
}

/**
 * Зеркало `ProductsSection.tsx`/`ServicesSection.tsx` (Content вместо
 * Commerce/Booking, см. ROADMAP.md §8 Phase 7) — та же логика «вкладка
 * видна всегда, секция сама предлагает включить капабилити», переиспользует
 * те же стили. Единственная реальная разница с Commerce/Booking — здесь нет
 * анонимного эндпоинта на запись вообще (посты пишет только владелец), так
 * что нет и рисков вроде подмены цены — весь список действий проще.
 */
export function BlogSection({ business, onCapabilityEnabled }: BlogSectionProps) {
  const fetcher = useCallback(() => getBlogPosts(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isEnabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null | 'new'>(null);
  const [confirmTarget, setConfirmTarget] = useState<BlogPost | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasContent = business.capabilities.includes('content');

  async function handleEnable() {
    setEnabling(true);
    setEnableError(null);
    try {
      await updateBusiness(business.id, { capabilities: [...business.capabilities, 'content'] });
      onCapabilityEnabled();
    } catch {
      setEnableError('Не удалось включить блог — попробуйте ещё раз');
    } finally {
      setEnabling(false);
    }
  }

  async function handleDelete(post: BlogPost) {
    setDeletingId(post.id);
    setDeleteError(null);
    try {
      await deleteBlogPost(business.id, post.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить пост — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  if (!hasContent) {
    return (
      <EmptyState
        title="Блог выключен"
        description="Включите его, чтобы публиковать новости и статьи — они появятся на сайте в блоке «Блог» и на отдельных страницах чтения."
        action={
          <>
            <Button onClick={() => void handleEnable()} disabled={isEnabling}>
              <NewspaperIcon />
              {isEnabling ? 'Включаем…' : 'Включить блог'}
            </Button>
            {enableError && (
              <p className={styles.error} role="alert">
                {enableError}
              </p>
            )}
          </>
        }
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем посты…" />
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
          Добавьте блок «Блог» в конструкторе, чтобы показать посты на сайте.
        </p>
        <Button onClick={() => setEditingPost('new')}>
          <PlusIcon />
          Новый пост
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одного поста"
          description="Добавьте первый пост — заголовок и текст достаточно, чтобы начать."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((post) => (
            <li key={post.id} className={styles.row}>
              <div className={styles['row__image']}>
                {post.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- превью загруженной обложки поста
                  <img src={post.coverImage} alt="" />
                ) : (
                  <NewspaperIcon />
                )}
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>
                  {post.title}
                  {!post.isPublished && <span className={styles.row__hidden}>черновик</span>}
                </span>
                <span className={styles.row__meta}>
                  {new Date(post.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Редактировать «${post.title}»`}
                onClick={() => setEditingPost(post)}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${post.title}»`}
                disabled={deletingId === post.id}
                onClick={() => setConfirmTarget(post)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingPost && (
        <BlogPostFormModal
          businessId={business.id}
          post={editingPost === 'new' ? null : editingPost}
          onSaved={() => {
            setEditingPost(null);
            void refetch();
          }}
          onClose={() => setEditingPost(null)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить пост «{confirmTarget.title}»? Это необратимо.
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
