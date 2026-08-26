import type { MouseEvent } from 'react';

/** Клик по инлайн-картинке внутри уже отрендеренного HTML-контента (см.
 * `dangerouslySetInnerHTML` у `PostCard`/`AdminPostsPanel`) открывает
 * лайтбокс с полным списком картинок этого блока — `src` сравнивается как
 * атрибут (относительный путь `/uploads/posts/...`), а не `element.src`
 * (резолвится в абсолютный URL текущего origin и не совпал бы напрямую). */
export function findClickedImageIndex(event: MouseEvent<HTMLDivElement>, images: string[]): number {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return -1;
  return images.indexOf(target.getAttribute('src') ?? '');
}
