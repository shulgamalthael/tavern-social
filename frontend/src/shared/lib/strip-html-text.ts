/**
 * Санитизированный HTML поста (см. `entities/post`'s `Post.text`) → обычный
 * текст для компактного превью (карточка шаренного поста в чате/модалке
 * пересылки) — там нет места для картинок/заголовков из полной разметки, в
 * отличие от «цитаты» репоста на самой карточке поста (та рендерит `text`
 * через `dangerouslySetInnerHTML` целиком, см. `PostCard.tsx`). Регулярка,
 * не `DOMParser`/`innerText` — одинаково работает и на сервере, и в браузере
 * (оба места, где используется, `'use client'`, но работать одинаково важнее,
 * чем не зависеть от этого сейчас), не требует лишнего рендера в скрытый DOM.
 */
export function stripHtmlText(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}
