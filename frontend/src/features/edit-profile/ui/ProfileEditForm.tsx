'use client';

import { useState } from 'react';
import { ImageUploadButton } from '@/features/upload-image';
import { updateProfile, uploadProfileImage, useCurrentUser } from '@/entities/user';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import styles from './ProfileEditForm.module.scss';

export interface ProfileEditFormProps {
  /** Вызывается и после сохранения, и после отмены — выходит из режима редактирования. */
  onDone: () => void;
}

/**
 * Редактирование собственного профиля — поля + аватар/обложка. Один
 * компонент вместо разнесённых форм: отмена просто размонтирует форму
 * (правки текстовых полей ещё не сохранены), а загрузка аватара/обложки
 * сохраняется сразу же (как и на других вкладках проекта — независимый
 * pending/error на каждую загружаемую картинку).
 */
export function ProfileEditForm({ onDone }: ProfileEditFormProps) {
  const { currentUser, applyProfileUpdate } = useCurrentUser();
  const [name, setName] = useState(currentUser.name);
  const [tagline, setTagline] = useState(currentUser.tagline);
  const [about, setAbout] = useState(currentUser.about ?? '');
  const [city, setCity] = useState(currentUser.city ?? '');
  const [tagsText, setTagsText] = useState(currentUser.tags.join(', '));
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const save = async () => {
    if (isPending) return;
    setPending(true);
    setError(null);
    try {
      const tags = tagsText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const patch = await updateProfile({ name, tagline, about, city, tags });
      applyProfileUpdate(patch);
      onDone();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить профиль');
    } finally {
      setPending(false);
    }
  };

  const uploadImage = async (kind: 'avatar' | 'cover', file: Blob) => {
    setImageError(null);
    try {
      const patch = await uploadProfileImage(kind, file);
      applyProfileUpdate(patch);
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить изображение',
      );
    }
  };

  return (
    <Card className={styles.form}>
      <h2 className={styles['form__title']}>Правка страницы</h2>

      <div className={styles['form__images']}>
        <div className={styles['form__cover-preview']}>
          {currentUser.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- превью локально обрезанного изображения, не оптимизируемый Next Image-контент
            <img src={currentUser.coverUrl} alt="" className={styles['form__cover-image']} />
          ) : (
            <MediaPlaceholder label="обложка страницы · 1600×400" height="100%" flush />
          )}
          <ImageUploadButton
            aspect={3}
            shape="rect"
            upload={(file) => uploadImage('cover', file)}
            className={styles['form__cover-trigger']}
          >
            Сменить обложку
          </ImageUploadButton>
        </div>

        <div className={styles['form__avatar-row']}>
          <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} size="xl" bordered />
          <ImageUploadButton
            aspect={1}
            shape="round"
            upload={(file) => uploadImage('avatar', file)}
            className={styles['form__avatar-trigger']}
          >
            Сменить аватар
          </ImageUploadButton>
        </div>
        {imageError && <p className={styles['form__error']}>{imageError}</p>}
      </div>

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>Имя</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
      </label>

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>Подпись у имени</span>
        <input
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
          maxLength={120}
          placeholder="Например: держу стол книжных разговоров"
        />
      </label>

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>О себе</span>
        <textarea
          value={about}
          onChange={(event) => setAbout(event.target.value)}
          maxLength={500}
          rows={3}
        />
      </label>

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>Город</span>
        <input value={city} onChange={(event) => setCity(event.target.value)} maxLength={80} />
      </label>

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>Теги — через запятую</span>
        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="настолки, книги, кофе"
        />
      </label>

      {error && <p className={styles['form__error']}>{error}</p>}

      <div className={styles['form__actions']}>
        <Button variant="outline" onClick={onDone} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={() => void save()} disabled={isPending}>
          {isPending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </Card>
  );
}
