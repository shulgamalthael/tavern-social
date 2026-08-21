'use client';

import { usePostStore, type Post } from '@/entities/post';
import { Modal } from '@/shared/ui/Modal';
import { PostEditor } from './PostEditor';
import styles from './EditPostModal.module.scss';

export interface EditPostModalProps {
  post: Post;
  onClose: () => void;
}

/**
 * Модалка редактирования собственного поста — открывается из `PostCard`
 * (`entities/post`) через колбэк `onEdit`, но рендерится widget'ом, а не
 * самой карточкой: `entities/post` не может импортировать `features/*`
 * (см. AGENTS.md, направление зависимостей FSD). Одна общая реализация с
 * созданием поста (`PostEditor`, режим `edit`), а не отдельная форма.
 */
export function EditPostModal({ post, onClose }: EditPostModalProps) {
  const updatePost = usePostStore((state) => state.updatePost);

  return (
    <Modal onClose={onClose} label="Редактировать запись" className={styles['edit-post-modal']}>
      <h2 className={styles['edit-post-modal__title']}>Редактировать запись</h2>
      <PostEditor
        mode="edit"
        post={post}
        submitLabel="Сохранить"
        pendingLabel="Сохраняем…"
        onCancel={onClose}
        onSubmit={async ({ text, images }) => {
          await updatePost(post.id, { text, images });
          onClose();
        }}
      />
    </Modal>
  );
}
