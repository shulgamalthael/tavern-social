/** Строка "Медиатеки" бизнеса (см. комментарий модели `MediaAsset` в
 * backend schema.prisma) — попадает сюда как побочный эффект любой уже
 * существующей бизнес-загрузки картинки (ассет сайта, фото товара/услуги,
 * обложка поста блога), не через отдельную форму загрузки. Единственный
 * потребитель на frontend — `MediaLibraryModal` в инспекторе Website
 * Builder'а (`ImageField.tsx`). */
export interface MediaAsset {
  id: string;
  businessId: string;
  url: string;
  mimeType: string;
  createdAt: string;
}
