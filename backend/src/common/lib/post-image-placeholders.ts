import { BadRequestException } from '@nestjs/common';

const PLACEHOLDER_PATTERN = /src="attachment:(\d+)"/g;
const IMAGE_SRC_PATTERN = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;

/**
 * Заменяет `src="attachment:N"` — плейсхолдеры, которые редактор (Tiptap,
 * `features/publish-post/ui/PostEditor.tsx`) вставляет для ещё не
 * загруженных картинок — на реальные URL только что сохранённых файлов, по
 * порядку N. Уже существующие картинки (режим редактирования) приходят с
 * настоящим `/uploads/posts/...` src и этой подстановки не касаются.
 *
 * Бросает `BadRequestException`, если число плейсхолдеров не совпадает с
 * числом загруженных файлов — рассинхрон между тем, что редактор показал
 * пользователю, и тем, что реально пришло на сервер.
 */
export function substitutePendingImagePlaceholders(html: string, uploadedUrls: string[]): string {
  const placeholderCount = [...html.matchAll(PLACEHOLDER_PATTERN)].length;
  if (placeholderCount !== uploadedUrls.length) {
    throw new BadRequestException(
      'Число новых изображений в тексте не совпадает с числом загруженных файлов',
    );
  }

  let index = 0;
  return html.replace(PLACEHOLDER_PATTERN, () => `src="${uploadedUrls[index++]}"`);
}

/** URL картинок в контенте поста, в порядке появления — не источник
 * контента (тот только `Post.text`), только удобный список для
 * `ImageLightbox` на frontend и для подсчёта лимита `MAX_POST_IMAGES`. */
export function extractImageUrls(html: string): string[] {
  return [...html.matchAll(IMAGE_SRC_PATTERN)].map((match) => match[1]);
}
