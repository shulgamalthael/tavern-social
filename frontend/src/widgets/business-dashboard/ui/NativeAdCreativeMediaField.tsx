'use client';

import { useRef, useState } from 'react';
import {
  uploadNativeAdCreativeImage,
  uploadNativeAdCreativeVideo,
  type NativeAdCreativeStyle,
} from '@/entities/native-ad';
import { ImageUploadButton } from '@/features/upload-image';
import { Loader } from '@/shared/ui/Loader';
import { TrashIcon, UploadIcon, VideoIcon } from '@/shared/ui/icons';
import styles from './ProductImageField.module.scss';

export interface NativeAdCreativeMediaFieldProps {
  style: NativeAdCreativeStyle;
  imageUrl: string | null;
  videoUrl: string | null;
  onImageChange: (url: string | null) => void;
  onVideoChange: (url: string | null) => void;
  businessId: string;
}

/** Соотношение сторон кропа по стилю — то же соответствие, что и layout в
 * `NativeAdCard` (`ad__media--{style}`), чтобы кроп совпадал с тем, как
 * картинка реально впишется в карточку ленты. У видео кропа нет — тот же
 * принцип, что `AdCreativeMediaField` (обрезка кадра видео вне слайса). */
const CROP_ASPECT: Record<Exclude<NativeAdCreativeStyle, 'video'>, number> = {
  minimal: 1,
  editorial: 1 / 0.52,
  product: 1,
};

export function NativeAdCreativeMediaField({
  style,
  imageUrl,
  videoUrl,
  onImageChange,
  onVideoChange,
  businessId,
}: NativeAdCreativeMediaFieldProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setUploadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  async function onImageUpload(file: Blob) {
    const { url } = await uploadNativeAdCreativeImage(businessId, file);
    onImageChange(url);
  }

  async function onVideoFileSelected(file: File) {
    setVideoError(null);
    setUploadingVideo(true);
    try {
      const { url } = await uploadNativeAdCreativeVideo(businessId, file);
      onVideoChange(url);
    } catch {
      setVideoError('Не удалось загрузить видео');
    } finally {
      setUploadingVideo(false);
    }
  }

  if (style === 'video') {
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
          aspect={CROP_ASPECT[style]}
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
