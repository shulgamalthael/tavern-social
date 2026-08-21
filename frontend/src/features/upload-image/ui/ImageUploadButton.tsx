'use client';

import { type ChangeEvent, type ReactNode, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { cropImageToBlob } from '../lib/crop-image-to-blob';
import styles from './ImageUploadButton.module.scss';

export interface ImageUploadButtonProps {
  /** Соотношение сторон кропа — 1 для аватара, 3 для широкой обложки, и т. д.
   * Не нужен при `crop={false}`. */
  aspect?: number;
  /** 'round' — маска-кружок в превью (аватар), 'rect' — прямоугольная
   * (обложка). Не один и тот же crop для всех типов изображений. */
  shape?: 'round' | 'rect';
  /** `false` — без модалки обрезки: файл уходит на загрузку как есть, во
   * весь оригинальный кадр. Для галереи, где важно сохранить полное фото,
   * а не подгонять его под квадрат, как аватар. */
  crop?: boolean;
  /** Реальная загрузка на сервер — своя функция для аватара/обложки/галереи,
   * получает Blob (обрезанный, если `crop` не выключен, иначе исходный файл). */
  upload: (file: Blob) => Promise<void>;
  children: ReactNode;
  className?: string;
}

/**
 * Кнопка-триггер + модалка обрезки в одном компоненте — переиспользуется для
 * аватара, обложки и галереи (см. `widgets/profile`), сама решает
 * выбор файла → превью кропа (если включён) → подтверждение → загрузку с
 * независимым loading/error состоянием.
 */
export function ImageUploadButton({
  aspect = 1,
  shape = 'rect',
  crop: cropEnabled = true,
  upload,
  children,
  className,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadWithoutCrop = async (file: File) => {
    setPending(true);
    setError(null);
    try {
      await upload(file);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось загрузить изображение',
      );
    } finally {
      setPending(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Разрешает выбрать тот же файл повторно после отмены/ошибки.
    event.target.value = '';
    if (!file) return;

    if (!cropEnabled) {
      void uploadWithoutCrop(file);
      return;
    }

    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setError(null);
  };

  const close = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCroppedArea(null);
  };

  const confirm = async () => {
    if (!imageSrc || !croppedArea || isPending) return;
    setPending(true);
    setError(null);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedArea);
      await upload(blob);
      close();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось загрузить изображение',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={cn(styles.trigger, className)}
        onClick={() => inputRef.current?.click()}
        disabled={!cropEnabled && isPending}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles['visually-hidden']}
        onChange={onFileChange}
      />

      {/* Без модалки обрезки ошибку загрузки больше негде показать — модалка
          в этом режиме никогда не открывается. */}
      {!cropEnabled && error && <p className={styles.error}>{error}</p>}

      {imageSrc && (
        <div className={styles.overlay} role="dialog" aria-label="Обрезка изображения">
          <div className={styles.modal}>
            <div className={styles.stage}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={shape}
                showGrid={shape === 'rect'}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className={styles.zoom}
              aria-label="Масштаб"
            />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Отмена
              </Button>
              <Button onClick={() => void confirm()} disabled={isPending}>
                {isPending ? 'Загружаем…' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
