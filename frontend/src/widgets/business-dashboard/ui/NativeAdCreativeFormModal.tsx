'use client';

import { useState, type FormEvent } from 'react';
import {
  addNativeAdCreative,
  NATIVE_AD_CREATIVE_STYLE_LABELS,
  type NativeAdCreativeStyle,
} from '@/entities/native-ad';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { NativeAdCreativeMediaField } from './NativeAdCreativeMediaField';
import formStyles from './ProductFormModal.module.scss';

export interface NativeAdCreativeFormModalProps {
  businessId: string;
  campaignId: string;
  onSaved: () => void;
  onClose: () => void;
}

const SELECTABLE_STYLES: NativeAdCreativeStyle[] = ['minimal', 'editorial', 'product', 'video'];

/** Только создание — тот же принцип, что `AdCreativeFormModal` (сайтовая
 * реклама): backend не поддерживает редактирование, только `addCreative`/
 * `removeCreative`, доступно только пока кампания в статусе `draft`. */
export function NativeAdCreativeFormModal({
  businessId,
  campaignId,
  onSaved,
  onClose,
}: NativeAdCreativeFormModalProps) {
  const [style, setStyle] = useState<NativeAdCreativeStyle>('minimal');
  const [headline, setHeadline] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ctaLabel, setCtaLabel] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onStyleChange(nextStyle: NativeAdCreativeStyle) {
    setStyle(nextStyle);
    if (nextStyle === 'video') {
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
    if (style === 'video' && !videoUrl) {
      setError('Загрузите видео для стиля "Видео"');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await addNativeAdCreative(businessId, campaignId, {
        style,
        headline: headline.trim(),
        bodyText: bodyText.trim() || undefined,
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

      <form className={formStyles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Стиль</span>
          <select
            className={formStyles.input}
            value={style}
            onChange={(event) => onStyleChange(event.target.value as NativeAdCreativeStyle)}
          >
            {SELECTABLE_STYLES.map((value) => (
              <option key={value} value={value}>
                {NATIVE_AD_CREATIVE_STYLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <NativeAdCreativeMediaField
          style={style}
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
          <span className={formStyles.label}>Текст (необязательно)</span>
          <textarea
            className={formStyles.textarea}
            rows={2}
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Только до конца месяца"
            maxLength={280}
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
