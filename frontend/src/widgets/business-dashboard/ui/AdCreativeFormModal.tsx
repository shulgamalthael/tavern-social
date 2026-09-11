'use client';

import { useState, type FormEvent } from 'react';
import { addAdCreative, AD_FORMAT_LABELS, type AdFormat } from '@/entities/advertising';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { AdCreativeMediaField } from './AdCreativeMediaField';
import { AdCreativePreview } from './AdCreativePreview';
import formStyles from './ProductFormModal.module.scss';

export interface AdCreativeFormModalProps {
  businessId: string;
  campaignId: string;
  onSaved: () => void;
  onClose: () => void;
}

/** Все форматы теперь выбираемы — `video` включён с тех пор, как появился
 * реальный пайплайн загрузки видео (`AdCreativeMediaField`,
 * `uploadAdCreativeVideo`, backend `createVideoMulterOptions`). */
const SELECTABLE_FORMATS: AdFormat[] = [
  'banner',
  'large_banner',
  'rectangle',
  'square',
  'mobile_banner',
  'native',
  'card',
  'video',
];

/** Только создание — редактирование креатива backend не поддерживает (см.
 * `AdCampaignsService`, только `addCreative`/`removeCreative`), поменять
 * содержимое — удалить и добавить заново. Доступно только пока кампания в
 * статусе `draft` (см. `AdvertisingSection`, кнопка скрыта иначе). */
export function AdCreativeFormModal({
  businessId,
  campaignId,
  onSaved,
  onClose,
}: AdCreativeFormModalProps) {
  const [format, setFormat] = useState<AdFormat>('banner');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ctaLabel, setCtaLabel] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Смена формата не должна оставить несовместимую пару "формат X, но
   * прикреплён videoUrl/imageUrl от предыдущего формата" — backend отклонит
   * такое (`AdCampaignsService.addCreative`'s "videoUrl допустим только для
   * формата video"), но лучше не дать этому случиться вовсе, а не ловить
   * ошибку сабмита. */
  function onFormatChange(nextFormat: AdFormat) {
    setFormat(nextFormat);
    if (nextFormat === 'video') {
      setImageUrl(null);
    } else {
      setVideoUrl(null);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!headline.trim()) {
      setError('Введите заголовок');
      return;
    }
    if (!targetUrl.trim()) {
      setError('Укажите ссылку, куда ведёт реклама');
      return;
    }
    if (format === 'video' && !videoUrl) {
      setError('Загрузите видео для формата "Видео"');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await addAdCreative(businessId, campaignId, {
        format,
        headline: headline.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl ?? undefined,
        videoUrl: videoUrl ?? undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        targetUrl: targetUrl.trim(),
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось добавить креатив');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Новый креатив" className={formStyles.modal}>
      <h2 className={formStyles.title}>Новый креатив</h2>

      <AdCreativePreview
        format={format}
        headline={headline}
        description={description}
        ctaLabel={ctaLabel}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      <form className={formStyles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Формат</span>
          <select
            className={formStyles.input}
            value={format}
            onChange={(event) => onFormatChange(event.target.value as AdFormat)}
          >
            {SELECTABLE_FORMATS.map((value) => (
              <option key={value} value={value}>
                {AD_FORMAT_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <AdCreativeMediaField
          format={format}
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          onImageChange={setImageUrl}
          onVideoChange={setVideoUrl}
          businessId={businessId}
        />

        <label className={formStyles.field}>
          <span className={formStyles.label}>Заголовок</span>
          <input
            type="text"
            className={formStyles.input}
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="Скидка 20% на всё"
            maxLength={90}
            autoFocus
          />
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>Описание (необязательно)</span>
          <textarea
            className={formStyles.textarea}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Только до конца месяца"
            maxLength={200}
          />
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>Текст кнопки (необязательно)</span>
          <input
            type="text"
            className={formStyles.input}
            value={ctaLabel}
            onChange={(event) => setCtaLabel(event.target.value)}
            placeholder="Подробнее"
            maxLength={30}
          />
        </label>

        <label className={formStyles.field}>
          <span className={formStyles.label}>Ссылка перехода</span>
          <input
            type="url"
            className={formStyles.input}
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            placeholder="https://example.com"
          />
        </label>

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Сохраняем…' : 'Добавить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
