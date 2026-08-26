'use client';

import { useState } from 'react';
import type { WebsitePage } from '@/entities/website';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { ImageField } from '../inspector/ImageField';
import styles from './PageSeoModal.module.scss';

export interface PageSeoModalProps {
  page: WebsitePage;
  businessId: string;
  onSave: (patch: Pick<WebsitePage, 'seoTitle' | 'seoDescription' | 'ogImage'>) => void;
  onClose: () => void;
}

/**
 * Переопределение метаданных одной страницы — см. `WebsitePage.seoTitle`/
 * `seoDescription`/`ogImage` (backend schema.prisma) и `generateMetadata` в
 * `app/site/[businessId]/[[...slug]]/page.tsx`, который читает эти поля с
 * фолбэком на настройки сайта (`WebsiteDocument.settings`). Сохраняет через
 * `store.updatePageSeo` — то же клиентское состояние документа, что и
 * остальные правки билдера, автосохранение подхватывает его тем же debounce
 * (см. `use-autosave.ts`), отдельного API-вызова здесь нет.
 */
export function PageSeoModal({ page, businessId, onSave, onClose }: PageSeoModalProps) {
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? '');
  const [ogImage, setOgImage] = useState<string | null>(page.ogImage ?? null);

  function handleSave() {
    onSave({
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      ogImage,
    });
    onClose();
  }

  return (
    <Modal onClose={onClose} label="SEO страницы" className={styles.modal}>
      <h2 className={styles.title}>SEO страницы «{page.title}»</h2>
      <p className={styles.hint}>
        Необязательно — если оставить пустым, используются настройки сайта из вкладки «Тема».
      </p>

      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Заголовок для поиска и соцсетей</span>
          <input
            className={styles.input}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            placeholder={page.title}
            maxLength={200}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Описание для поиска и соцсетей</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
            maxLength={300}
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Картинка для соцсетей (Open Graph)</span>
          <ImageField value={ogImage} onChange={setOgImage} businessId={businessId} />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Отмена
        </button>
        <Button onClick={handleSave}>Сохранить</Button>
      </div>
    </Modal>
  );
}
