'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { addAdCreative, AD_FORMAT_LABELS, type AdFormat } from '@/entities/advertising';
import { getProducts, type Product } from '@/entities/product';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { formatMoney } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Modal } from '@/shared/ui/Modal';
import { AdCreativeMediaField } from './AdCreativeMediaField';
import { AdCreativePreview } from './AdCreativePreview';
import formStyles from './ProductFormModal.module.scss';
import creativeStyles from './AdCreativeFormModal.module.scss';

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

type CreativeSource = 'manual' | 'product';

/** Только создание — редактирование креатива backend не поддерживает (см.
 * `AdCampaignsService`, только `addCreative`/`removeCreative`), поменять
 * содержимое — удалить и добавить заново. Доступно только пока кампания в
 * статусе `draft` (см. `AdvertisingSection`, кнопка скрыта иначе).
 *
 * Источник содержимого — «свой креатив» (как раньше) или «карточка
 * товара»: во втором случае headline/description/imageUrl/format НЕ
 * отправляются вовсе — backend сам снимает слепок с выбранного `Product`
 * (см. `AdCampaignsService.addCreative`'s `productId`-ветка). Здесь эти
 * поля вычисляются из товара только для живого превью
 * (`AdCreativePreview` не отличает, откуда взялись пропы). */
export function AdCreativeFormModal({
  businessId,
  campaignId,
  onSaved,
  onClose,
}: AdCreativeFormModalProps) {
  const [source, setSource] = useState<CreativeSource>('manual');
  const [format, setFormat] = useState<AdFormat>('banner');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ctaLabel, setCtaLabel] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => getProducts(businessId), [businessId]);
  const products = useAsyncData(fetchProducts);
  const activeProducts: Product[] = (products.data ?? []).filter((product) => product.isActive);
  const selectedProduct =
    activeProducts.find((product) => product.id === selectedProductId) ?? null;

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

    if (!targetUrl.trim()) {
      setError('Укажите ссылку, куда ведёт реклама');
      return;
    }

    if (source === 'product') {
      if (!selectedProduct) {
        setError('Выберите товар');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        await addAdCreative(businessId, campaignId, {
          productId: selectedProduct.id,
          ctaLabel: ctaLabel.trim() || undefined,
          targetUrl: targetUrl.trim(),
        });
        onSaved();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : 'Не удалось добавить креатив',
        );
        setSubmitting(false);
      }
      return;
    }

    if (!headline.trim()) {
      setError('Введите заголовок');
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

  const previewFormat = source === 'product' ? 'card' : format;
  const previewHeadline = source === 'product' ? (selectedProduct?.name ?? '') : headline;
  const previewDescription =
    source === 'product' ? (selectedProduct?.description ?? '') : description;
  const previewImageUrl = source === 'product' ? (selectedProduct?.images[0] ?? null) : imageUrl;
  const previewVideoUrl = source === 'product' ? null : videoUrl;

  return (
    <Modal onClose={onClose} label="Новый креатив" className={formStyles.modal}>
      <h2 className={formStyles.title}>Новый креатив</h2>

      <div className={creativeStyles['source-toggle']}>
        <Button
          type="button"
          variant={source === 'manual' ? 'primary' : 'chip'}
          onClick={() => setSource('manual')}
        >
          Свой креатив
        </Button>
        <Button
          type="button"
          variant={source === 'product' ? 'primary' : 'chip'}
          onClick={() => setSource('product')}
        >
          Карточка товара
        </Button>
      </div>

      <AdCreativePreview
        format={previewFormat}
        headline={previewHeadline}
        description={previewDescription}
        ctaLabel={ctaLabel}
        imageUrl={previewImageUrl}
        videoUrl={previewVideoUrl}
      />

      <form className={formStyles.form} onSubmit={(event) => void onSubmit(event)}>
        {source === 'product' ? (
          activeProducts.length === 0 && products.status === 'success' ? (
            <EmptyState
              title="Нет товаров для рекламы"
              description="Заведите активный товар в разделе «Товары», чтобы сделать из него рекламную карточку."
            />
          ) : (
            <label className={formStyles.field}>
              <span className={formStyles.label}>Товар</span>
              <select
                className={formStyles.input}
                value={selectedProductId ?? ''}
                onChange={(event) => setSelectedProductId(event.target.value || null)}
              >
                <option value="">Выберите товар</option>
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {formatMoney(product.priceCents, product.currency)}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <>
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
          </>
        )}

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
