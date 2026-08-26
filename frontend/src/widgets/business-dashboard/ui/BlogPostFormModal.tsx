'use client';

import { useState, type FormEvent } from 'react';
import { createBlogPost, updateBlogPost, type BlogPost } from '@/entities/blog-post';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { BlogPostImageField } from './BlogPostImageField';
import styles from './ProductFormModal.module.scss';

export interface BlogPostFormModalProps {
  businessId: string;
  /** `null` — создание нового поста, иначе — редактирование существующего. */
  post: BlogPost | null;
  onSaved: () => void;
  onClose: () => void;
}

/** Зеркало `ProductFormModal.tsx`/`ServiceFormModal.tsx` — переиспользует те
 * же стили. `content` — обычная `<textarea>`, не WYSIWYG-редактор, см.
 * комментарий модели `BlogPost` на backend о том, почему полноценный
 * TipTap-редактор здесь сознательно не переиспользован в этом инкременте. */
export function BlogPostFormModal({ businessId, post, onSaved, onClose }: BlogPostFormModalProps) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [isPublished, setIsPublished] = useState(post?.isPublished ?? false);
  const [coverImage, setCoverImage] = useState<string | null>(post?.coverImage ?? null);
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? '');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      setError('Введите заголовок');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const input = {
        title: title.trim(),
        excerpt: excerpt.trim(),
        content,
        isPublished,
        coverImage,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
      };
      if (post) {
        await updateBlogPost(businessId, post.id, input);
      } else {
        await createBlogPost(businessId, input);
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить пост');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={post ? 'Редактировать пост' : 'Новый пост'}
      className={styles.modal}
    >
      <h2 className={styles.title}>{post ? 'Редактировать пост' : 'Новый пост'}</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <BlogPostImageField value={coverImage} onChange={setCoverImage} businessId={businessId} />

        <label className={styles.field}>
          <span className={styles.label}>Заголовок</span>
          <input
            type="text"
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Как мы открылись"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Анонс (показывается в карточке)</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="Короткая история о том, как всё начиналось"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Текст поста</span>
          <textarea
            className={styles.textarea}
            rows={10}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={'Первый абзац.\n\nВторой абзац — пустая строка между абзацами.'}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>SEO-заголовок (необязательно)</span>
          <input
            type="text"
            className={styles.input}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            placeholder={title || 'По умолчанию — заголовок поста'}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>SEO-описание (необязательно)</span>
          <textarea
            className={styles.textarea}
            rows={2}
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
            placeholder={excerpt || 'По умолчанию — анонс поста'}
          />
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          <span>Опубликовать на сайте</span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
