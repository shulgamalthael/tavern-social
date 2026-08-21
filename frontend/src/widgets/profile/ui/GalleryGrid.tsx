'use client';

import { useEffect, useState } from 'react';
import {
  deleteGalleryImage,
  getGallery,
  type GalleryImage,
  uploadGalleryImage,
} from '@/entities/gallery';
import { usePostStore } from '@/entities/post';
import { ImageUploadButton } from '@/features/upload-image';
import { useNavigationStore } from '@/features/section-navigation';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { GalleryLightbox } from './GalleryLightbox';
import styles from './GalleryGrid.module.scss';

export interface GalleryGridProps {
  userId: string;
  /** Загрузка и удаление доступны только на своей собственной галерее. */
  isOwn: boolean;
}

/** Сколько плиток показывает превью-сетка в сайдбаре профиля (не полная
 * галерея — та открывается через лайтбокс по клику). На своей странице одна
 * плитка уходит под «Добавить фото», поэтому там фото на одну меньше. */
const MAX_VISIBLE_TILES = 9;
/** За сколько фото до конца уже загруженного списка подгружать следующую
 * страницу при листании лайтбокса (см. эффект ниже) — с запасом, чтобы
 * подгрузка успела завершиться до того, как пользователь долистает до края. */
const LIGHTBOX_PREFETCH_THRESHOLD = 3;

/**
 * Галерея не завела свой Zustand-store (см. AGENTS.md §4) — данные видны
 * только пока открыт конкретный профиль, поэтому курсорная пагинация тем же
 * приёмом, что и `CommunitiesWidget`, а не отдельный стор. Превью-сетка
 * показывает первые 9 плиток загруженной страницы, а лайтбокс дальше
 * дозагружает страницы по мере пролистывания (см. эффект ниже) — так «+N» на
 * последней плитке и листание в лайтбоксе остаются честными даже для очень
 * большой галереи, а не только для первой загруженной страницы.
 */
export function GalleryGrid({ userId, isOwn }: GalleryGridProps) {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<GalleryImage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadMoreStatus, setLoadMoreStatus] = useState<AsyncStatus>('idle');
  const [reloadToken, setReloadToken] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    getGallery(userId)
      .then(({ images, nextCursor: firstCursor }) => {
        if (cancelled) return;
        setList(images);
        setNextCursor(firstCursor);
        setLoadMoreStatus('idle');
        setStatus('success');
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(
          loadError instanceof Error ? loadError.message : 'Не удалось загрузить фотографии',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  const refetch = () => {
    setStatus('loading');
    setError(null);
    setReloadToken((token) => token + 1);
  };

  /** Дозагружает следующую страницу, если пролистали лайтбокс близко к концу
   * уже загруженного списка — вызывается прямо из обработчиков навигации
   * лайтбокса (событие), а не из эффекта, следящего за индексом: так же, как
   * и загрузка первой страницы выше, `setLoadMoreStatus('loading')` не должен
   * выполняться синхронно в теле эффекта. */
  const maybePrefetchGallery = (index: number) => {
    if (!nextCursor || loadMoreStatus === 'loading') return;
    if (list.length - index > LIGHTBOX_PREFETCH_THRESHOLD) return;

    setLoadMoreStatus('loading');
    void getGallery(userId, nextCursor)
      .then(({ images, nextCursor: newCursor }) => {
        setList((prev) => [...prev, ...images]);
        setNextCursor(newCursor);
        setLoadMoreStatus('success');
      })
      .catch(() => setLoadMoreStatus('error'));
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    maybePrefetchGallery(index);
  };

  const changeLightboxIndex = (index: number) => {
    setLightboxIndex(index);
    maybePrefetchGallery(index);
  };
  const photoSlotCount = isOwn ? MAX_VISIBLE_TILES - 1 : MAX_VISIBLE_TILES;
  const visiblePhotos = list.slice(0, photoSlotCount);
  // Первая страница (DEFAULT_GALLERY_LIMIT) заведомо больше, чем количество
  // видимых плиток, — если `nextCursor` вообще появится после первой
  // страницы, `hiddenCount` уже будет положительным и без него.
  const hiddenCount = list.length - visiblePhotos.length;

  const receiveNewPost = usePostStore((state) => state.receiveNewPost);
  const removeLocalPost = usePostStore((state) => state.removeLocalPost);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);

  const upload = async (file: Blob) => {
    setActionError(null);
    try {
      const { image, post } = await uploadGalleryImage(file);
      setList((prev) => [image, ...prev]);
      // Фото — это Post (см. AGENTS.md) — дописываем его в ленту/стену тем
      // же способом, что и обычную публикацию, иначе оно появилось бы там
      // только после следующей перезагрузки (см. задачу про синхронизацию
      // галереи и ленты).
      receiveNewPost(post);
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
      setList((prev) => prev.filter((image) => image.id !== imageId));
      // Удаление фото с backend удаляет и связанный Post (см. GalleryService.remove)
      // — без этого карточка осталась бы висеть в уже загруженной ленте/стене
      // до следующей перезагрузки (см. задачу про синхронизацию галереи и ленты).
      const deletedImage = list.find((image) => image.id === imageId);
      if (deletedImage?.postId) removeLocalPost(deletedImage.postId);
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
          <ImageUploadButton crop={false} upload={upload} className={styles['gallery__add']}>
            + Добавить фото
          </ImageUploadButton>
        )}
        {visiblePhotos.map((image, imageIndex) => {
          const isLastVisible = imageIndex === visiblePhotos.length - 1;
          const showMoreOverlay = isLastVisible && hiddenCount > 0;
          return (
            <div key={image.id} className={styles['gallery__tile']}>
              <button
                type="button"
                className={styles['gallery__tile-trigger']}
                onClick={() => openLightbox(imageIndex)}
                aria-label={
                  showMoreOverlay ? `Показать все фото — ещё ${hiddenCount}` : 'Открыть фото'
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- собственные загруженные превью, не оптимизируемый Next Image-контент */}
                <img src={image.url} alt="" className={styles['gallery__image']} />
                {showMoreOverlay && (
                  <span className={styles['gallery__more']} aria-hidden="true">
                    +{hiddenCount}
                  </span>
                )}
              </button>
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
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={list}
          index={lightboxIndex}
          onIndexChange={changeLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onAuthorClick={goToUserProfile}
        />
      )}
    </div>
  );
}
