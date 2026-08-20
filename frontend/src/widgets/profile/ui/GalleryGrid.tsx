'use client';

import { useCallback, useState } from 'react';
import {
  deleteGalleryImage,
  getGallery,
  type GalleryImage,
  uploadGalleryImage,
} from '@/entities/gallery';
import { ImageUploadButton } from '@/features/upload-image';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './GalleryGrid.module.scss';

export interface GalleryGridProps {
  userId: string;
  /** Загрузка и удаление доступны только на своей собственной галерее. */
  isOwn: boolean;
}

/**
 * Галерея не завела свой Zustand-store (см. AGENTS.md §4) — данные видны
 * только пока открыт конкретный профиль, поэтому `useAsyncData` +
 * локальный оверрайд после добавления/удаления, как уже принято для
 * `CommunitiesWidget`.
 */
export function GalleryGrid({ userId, isOwn }: GalleryGridProps) {
  const fetcher = useCallback(() => getGallery(userId), [userId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = images ?? data ?? [];

  const upload = async (file: Blob) => {
    setActionError(null);
    try {
      const image = await uploadGalleryImage(file);
      setImages([image, ...list]);
    } catch (uploadError) {
      setActionError(
        uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить изображение',
      );
    }
  };

  const remove = async (imageId: string) => {
    if (deletingId) return;
    setDeletingId(imageId);
    setActionError(null);
    try {
      await deleteGalleryImage(imageId);
      setImages(list.filter((image) => image.id !== imageId));
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : 'Не удалось удалить изображение',
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return <Loader label="Загружаем фотографии…" />;
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  if (list.length === 0 && !isOwn) {
    return <EmptyState title="Фотографий пока нет" />;
  }

  return (
    <div className={styles.gallery}>
      {actionError && <p className={styles['gallery__error']}>{actionError}</p>}
      <div className={styles['gallery__grid']}>
        {isOwn && (
          <ImageUploadButton
            aspect={1}
            shape="rect"
            upload={upload}
            className={styles['gallery__add']}
          >
            + Добавить фото
          </ImageUploadButton>
        )}
        {list.map((image) => (
          <div key={image.id} className={styles['gallery__tile']}>
            {/* eslint-disable-next-line @next/next/no-img-element -- собственные загруженные превью, не оптимизируемый Next Image-контент */}
            <img src={image.url} alt="" className={styles['gallery__image']} />
            {isOwn && (
              <button
                type="button"
                className={styles['gallery__delete']}
                onClick={() => void remove(image.id)}
                disabled={deletingId === image.id}
                aria-label="Удалить фото"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
