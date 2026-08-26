'use client';

import { useCallback } from 'react';
import { getMediaAssets } from '@/entities/media-asset';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './MediaLibraryModal.module.scss';

export interface MediaLibraryModalProps {
  businessId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

/**
 * Выбор уже загруженной картинки вместо повторной загрузки того же файла —
 * единственный потребитель `entities/media-asset` (см. её комментарий и
 * комментарий модели `MediaAsset` в backend schema.prisma). Показывает ВСЕ
 * картинки бизнеса независимо от того, какой upload-эндпоинт их изначально
 * принял (ассет сайта/фото товара/услуги/обложка поста) — переиспользовать
 * фото товара в Hero-блоке такой же законный сценарий, как переиспользовать
 * старый ассет сайта, поэтому фильтра по источнику здесь нет.
 */
export function MediaLibraryModal({ businessId, onSelect, onClose }: MediaLibraryModalProps) {
  const fetcher = useCallback(() => getMediaAssets(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  return (
    <Modal onClose={onClose} label="Медиатека" className={styles.card}>
      <h2 className={styles.title}>Медиатека</h2>

      {status === 'loading' && (
        <div className={styles.status}>
          <Loader label="Загружаем изображения…" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles.status}>
          <ErrorState message={error} onRetry={refetch} />
        </div>
      )}

      {status === 'success' && data && data.length === 0 && (
        <EmptyState
          title="Пока нет загруженных изображений"
          description="Загрузите первое фото через «Загрузить» — оно появится здесь для повторного использования."
        />
      )}

      {status === 'success' && data && data.length > 0 && (
        <div className={styles.grid}>
          {data.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className={styles.thumb}
              onClick={() => onSelect(asset.url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного файла из медиатеки, не оптимизируем через next/image */}
              <img src={asset.url} alt="" className={styles['thumb__image']} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
