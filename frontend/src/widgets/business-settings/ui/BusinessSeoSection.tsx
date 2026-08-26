'use client';

import { useState } from 'react';
import { updateBusiness, type Business } from '@/entities/business';
import { Button } from '@/shared/ui/Button';
import styles from './BusinessSettingsWidget.module.scss';

export interface BusinessSeoSectionProps {
  business: Business;
  onSaved: (business: Business) => void;
}

/**
 * `Business.seoTitle`/`seoDescription` существовали в API с самого начала
 * (владелец-CRUD через `updateBusiness`), но были полностью недостижимы из
 * UI — ни одна форма их не показывала (см. ROADMAP.md §3.11/§8 Phase 10).
 * Это фолбэк САМОГО НИЗКОГО приоритета для `generateMetadata` (страница →
 * настройки сайта → это поле → просто `business.name`) — используется,
 * когда владелец не задал ничего специфичного ни на уровне сайта
 * (`WebsiteDocument.settings`), ни на уровне конкретной страницы
 * (`WebsitePage.seoTitle`).
 *
 * Локальное состояние формы инициализируется из пропа при монтировании —
 * компонент рендерится только после того, как `business` уже загружен (см.
 * `BusinessSettingsWidget.tsx`), поэтому не нужен `useEffect`-синхронизация
 * с асинхронными данными.
 */
export function BusinessSeoSection({ business, onSaved }: BusinessSeoSectionProps) {
  const [seoTitle, setSeoTitle] = useState(business.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(business.seoDescription ?? '');
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateBusiness(business.id, {
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
      });
      onSaved(updated);
      setSaved(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles['section__head']}>
        <div>
          <h2 className={styles['section__title']}>SEO по умолчанию</h2>
          <p className={styles['section__hint']}>
            Используется, если страница или сайт не задают собственные заголовок/описание для поиска
            и соцсетей.
          </p>
        </div>
      </div>

      <div className={styles.seoForm}>
        <label className={styles.seoField}>
          <span className={styles.seoLabel}>Заголовок</span>
          <input
            type="text"
            className={styles.seoInput}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
            placeholder={business.name}
            maxLength={200}
          />
        </label>

        <label className={styles.seoField}>
          <span className={styles.seoLabel}>Описание</span>
          <textarea
            className={styles.seoTextarea}
            rows={2}
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
            maxLength={300}
          />
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.seoActions}>
          {isSaved && <span className={styles.seoSaved}>Сохранено</span>}
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </section>
  );
}
