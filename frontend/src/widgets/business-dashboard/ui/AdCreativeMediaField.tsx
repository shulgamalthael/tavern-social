'use client';

import { useRef, useState } from 'react';
import {
  uploadAdCreativeImage,
  uploadAdCreativeVideo,
  type AdFormat,
} from '@/entities/advertising';
import { ImageUploadButton } from '@/features/upload-image';
import { Loader } from '@/shared/ui/Loader';
import { TrashIcon, UploadIcon, VideoIcon } from '@/shared/ui/icons';
import { AD_FORMAT_PREVIEW_CONFIG } from './ad-format-preview-config';
import styles from './ProductImageField.module.scss';

export interface AdCreativeMediaFieldProps {
  format: AdFormat;
  imageUrl: string | null;
  videoUrl: string | null;
  onImageChange: (url: string | null) => void;
  onVideoChange: (url: string | null) => void;
  businessId: string;
}

/**
 * Заменяет `AdCreativeImageField` (§68 series) — теперь формат-зависимая:
 * `format === 'video'` показывает загрузку видео (`uploadAdCreativeVideo`,
 * `POST .../advertising/creatives/videos`, backend `createVideoMulterOptions`),
 * иначе — загрузку картинки С обрезкой (`ImageUploadButton`, тот же
 * переиспользуемый кроппер, что у аватара/обложки профиля), `aspect`
 * которого берётся из `AD_FORMAT_PREVIEW_CONFIG[format]` — выбор формата
 * согласованно меняет и пропорции превью (`AdCreativePreview`), и форму
 * кропа. GIF — через расширенный `accept` у `ImageUploadButton`, обходит
 * кроп-модалку целиком (см. её комментарий), чтобы не потерять анимацию.
 *
 * Видео НЕ кропается — обрезка кадра видео через canvas не входит в этот
 * слайс (только картинки), только выбор/загрузка/превью.
 */
export function AdCreativeMediaField({
  format,
  imageUrl,
  videoUrl,
  onImageChange,
  onVideoChange,
  businessId,
}: AdCreativeMediaFieldProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  async function onImageUpload(file: Blob) {
    const { url } = await uploadAdCreativeImage(businessId, file);
    onImageChange(url);
  }

  async function onVideoFileSelected(file: File) {
    setVideoError(null);
    setUploadingVideo(true);
    try {
      const { url } = await uploadAdCreativeVideo(businessId, file);
      onVideoChange(url);
    } catch {
      setVideoError('Не удалось загрузить видео');
    } finally {
      setUploadingVideo(false);
    }
  }

  if (format === 'video') {
    return (
      <div className={styles.field}>
        <div className={styles.preview}>
          {videoUrl ? (
            <video src={videoUrl} className={styles['preview__image']} muted loop controls />
          ) : (
            <span className={styles['preview__empty']}>Нет видео</span>
          )}
        </div>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm"
          className={styles.input}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onVideoFileSelected(file);
            event.target.value = '';
          }}
        />

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={isUploadingVideo}
            onClick={() => videoInputRef.current?.click()}
          >
            {isUploadingVideo ? (
              <Loader label="Загружаем…" />
            ) : (
              <>
                <VideoIcon />
                {videoUrl ? 'Заменить видео' : 'Загрузить видео'}
              </>
            )}
          </button>
          {videoUrl && (
            <button
              type="button"
              className={styles['button--danger']}
              aria-label="Убрать видео"
              onClick={() => onVideoChange(null)}
            >
              <TrashIcon />
            </button>
          )}
        </div>

        {videoError && <p className={styles.error}>{videoError}</p>}
      </div>
    );
  }

  const { width, height } = AD_FORMAT_PREVIEW_CONFIG[format];

  return (
    <div className={styles.field}>
      <div className={styles.preview}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- превью произвольного загруженного URL
          <img src={imageUrl} alt="" className={styles['preview__image']} />
        ) : (
          <span className={styles['preview__empty']}>Нет изображения</span>
        )}
      </div>

      <div className={styles.actions}>
        <ImageUploadButton
          aspect={width / height}
          shape="rect"
          accept="image/jpeg,image/png,image/webp,image/gif"
          upload={onImageUpload}
          className={styles.button}
        >
          <UploadIcon />
          {imageUrl ? 'Заменить изображение' : 'Загрузить изображение'}
        </ImageUploadButton>
        {imageUrl && (
          <button
            type="button"
            className={styles['button--danger']}
            aria-label="Убрать изображение"
            onClick={() => onImageChange(null)}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}
