'use client';

import { useRef, useState } from 'react';
import { uploadServiceImage } from '@/entities/service';
import { Loader } from '@/shared/ui/Loader';
import { TrashIcon, UploadIcon } from '@/shared/ui/icons';
import styles from './ProductImageField.module.scss';

export interface ServiceImageFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  businessId: string;
}

/** Зеркало `ProductImageField.tsx` — то же одно фото-обложка, только грузит
 * через `uploadServiceImage`, свой эндпоинт. Переиспользует те же стили
 * (`ProductImageField.module.scss`) — разметка идентична, заводить копию
 * ради другого имени файла не нужно. */
export function ServiceImageField({ value, onChange, businessId }: ServiceImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(file: File) {
    setError(null);
    setIsUploading(true);
    try {
      const { url } = await uploadServiceImage(businessId, file);
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
          // eslint-disable-next-line @next/next/no-img-element -- превью произвольного загруженного URL
          <img src={value} alt="" className={styles['preview__image']} />
        ) : (
          <span className={styles['preview__empty']}>Нет фото</span>
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
              {value ? 'Заменить фото' : 'Загрузить фото'}
            </>
          )}
        </button>
        {value && (
          <button
            type="button"
            className={styles['button--danger']}
            aria-label="Убрать фото"
            onClick={() => onChange(null)}
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
