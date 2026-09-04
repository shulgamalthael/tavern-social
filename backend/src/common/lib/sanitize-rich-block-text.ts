import sanitizeHtml from 'sanitize-html';

/**
 * Санитайзер для `props.text` блоков `text`/`richtext`/`quote` конструктора
 * сайтов (AI_PLATFORM_ROADMAP.md, «инлайн-редактирование текста») — узкий
 * вариант `sanitize-post-content.ts` (тот же `sanitize-html`, тот же приём
 * принудительного `rel="noopener noreferrer"` на ссылках), но allowlist
 * сильно уже: это поле только для ФОРМАТИРОВАНИЯ текста (жирный/курсив/
 * ссылка), не вёрстки — никаких `img`/`table`/`div`/`span`/классов/стилей,
 * в отличие от постов, где `PostEditor` осознанно поддерживает картинки и
 * стилизованные карточки. Frontend-редактор (`EditableRichText`,
 * `entities/website/ui/`) сам ограничен той же тройкой марок (Bold/Italic/
 * Link) через минимальный набор Tiptap-расширений — эта функция здесь как
 * настоящая граница доверия: вызывается в `WebsitesService.saveDraft` перед
 * записью в БД, а не полагается на то, что клиентский редактор не пришлёт
 * ничего лишнего (прямой вызов API в обход редактора — untrusted input).
 */
export function sanitizeRichBlockText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'a'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Принудительно, независимо от того, что прислал клиент — та же
      // причина, что в `sanitize-post-content.ts`: открытие внешней ссылки
      // без noopener/noreferrer раскрывает `window.opener` новой вкладке.
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true),
    },
  });
}
