import type { ReactNode } from 'react';

// Один цикл — либо `http(s)://...`, либо голый `www.домен...`; захватывающая
// группа ровно одна, чтобы `String.split` ниже честно чередовал
// текст/совпадение по чётности индекса, без повторного прогона регекспа.
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

// Частый случай — URL внутри обычного предложения («... заходи на
// example.com.» или «(example.com)») подхватывает конечную пунктуацию как
// часть адреса, если её не отрезать отдельно.
const TRAILING_PUNCTUATION = /[.,!?:;)\]}'"]+$/;

function normalizeHref(rawUrl: string): string | null {
  const trimmed = rawUrl.replace(TRAILING_PUNCTUATION, '');
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    // Единственная и обязательная защита от атак: `javascript:`/`data:`/
    // прочие псевдо-протоколы не могли бы стать кликабельной ссылкой, даже
    // если бы попали в текст сообщения (сам regex выше их и так не матчит,
    // но эта проверка не полагается только на regex — на случай, если он
    // когда-нибудь станет шире).
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Превращает голые URL внутри обычного текста в кликабельные ссылки. Всегда
 * возвращает React-узлы, никогда HTML-строку — текст между ссылками остаётся
 * обычным текстовым узлом, который React экранирует сам (в отличие от
 * `dangerouslySetInnerHTML`, здесь в принципе негде выполниться постороннему
 * тегу/скрипту). `href` отдельно валидируется через `normalizeHref` — если
 * протокол не http/https, кусок остаётся обычным текстом, а не ссылкой.
 */
export function linkifyText(text: string): ReactNode[] {
  const segments = text.split(URL_PATTERN);

  return segments.map((segment, index) => {
    // Нечётные индексы `split` с одной захватывающей группой — совпадения
    // регекспа, чётные — обычный текст между ними.
    if (index % 2 === 0) return segment;

    const href = normalizeHref(segment);
    if (!href) return segment;

    return (
      <a key={index} href={href} target="_blank" rel="noopener noreferrer nofollow">
        {segment}
      </a>
    );
  });
}
