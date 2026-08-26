'use client';

import { useRef, useState } from 'react';
import { uploadWebsiteAsset } from '@/entities/website';
import { Loader } from '@/shared/ui/Loader';
import { ImageIcon, TrashIcon, UploadIcon } from '@/shared/ui/icons';
import { MediaLibraryModal } from './MediaLibraryModal';
import styles from './ImageField.module.scss';

export interface ImageFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  businessId: string;
}

/**
 * Поле-картинка инспектора (`control: 'image'` в `FieldSchema`) — загружает
 * файл через `uploadWebsiteAsset` (см. `entities/website/api/
 * upload-website-asset.ts`, единый эндпоинт ассетов сайта конкретного
 * бизнеса) и сразу пишет полученный URL в `props` блока через `onChange`.
 * Без превью старого значения `value` — просто заглушка «нет изображения».
 *
 * «Библиотека» открывает `MediaLibraryModal` — выбор уже загруженной
 * картинки (этого сайта, товара, услуги или поста блога, см. `MediaAsset`)
 * вместо повторной загрузки того же файла. Единственное место в проекте,
 * где это нужно: остальные `*ImageField` (Dashboard-формы товара/услуги/
 * поста) загружают ОДНУ конкретную картинку сущности, а не выбирают из
 * общей библиотеки.
 */
export function ImageField({ value, onChange, businessId }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLibraryOpen, setLibraryOpen] = useState(false);

  async function onFileSelected(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadWebsiteAsset(businessId, file);
      onChange(url);
    } catch {
      setError('Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className={styles.field}>
      <div className={styles.preview}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- превью произвольного загруженного URL, не оптимизируем через next/image
          <img src={value} alt="" className={styles['preview__image']} />
        ) : (
          <span className={styles['preview__empty']}>Нет изображения</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.input}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFileSelected(file);
          event.target.value = '';
        }}
      />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Loader label="Загружаем…" />
          ) : (
            <>
              <UploadIcon />
              {value ? 'Заменить' : 'Загрузить'}
            </>
          )}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={isUploading}
          onClick={() => setLibraryOpen(true)}
        >
          <ImageIcon />
          Библиотека
        </button>
        {value && (
          <button
            type="button"
            className={styles['button--danger']}
            aria-label="Убрать изображение"
            onClick={() => onChange(null)}
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isLibraryOpen && (
        <MediaLibraryModal
          businessId={businessId}
          onSelect={(url) => {
            onChange(url);
            setLibraryOpen(false);
          }}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
}
