import sanitizeHtml from 'sanitize-html';

/** Картинка внутри контента поста может ссылаться только на файл, который
 * backend только что сам сохранил этому же посту (см. PostsService.create/
 * update — подстановка `attachment:N` → реальный URL происходит раньше
 * санитизации) — не на произвольный внешний адрес (hotlink/tracking-pixel
 * через `<img src>` иначе был бы возможен, раз тег теперь разрешён). */
const ALLOWED_IMAGE_SRC = /^\/uploads\/posts\/[0-9a-f-]+\.(jpg|png|webp)$/;

/** Запрещённые в значении `style` конструкции — современные браузеры больше
 * не исполняют JS через CSS (`expression()`/`behavior`/`-moz-binding` —
 * только старый IE), но эти конструкции всё ещё проверяем на всякий случай,
 * как и `url(...)` — им не место в пользовательском контенте: скрытый
 * трекинг-пиксель через `background: url(...)` или эксфильтрация данных
 * через CSS. Дальше — не парсим конкретные значения (валидный CSS и так не
 * может передать исполняемый код), просто белый список свойств ниже. */
const FORBIDDEN_STYLE_PATTERN = /url\(|expression\(|behavior\s*:|-moz-binding|javascript:/i;

const SAFE_STYLE_VALUE = new RegExp(`^(?!.*(${FORBIDDEN_STYLE_PATTERN.source})).+$`, 'i');

/**
 * CSS позволяет экранировать любой символ через `\` + до 6 hex-цифр
 * (Unicode-кодпоинт, опционально с завершающим пробелом-разделителем) или
 * `\` + сам символ буквально — так `\75 rl(...)`/`\75rl(...)` браузер
 * читает как `url(...)`, а `SAFE_STYLE_VALUE` выше ищет запрещённые
 * конструкции только в исходном виде строки и такой escape не ловит.
 * Раскрываем escape-последовательности в реальные символы до проверки —
 * само значение при этом не меняем (экранирование — валидный CSS сам по
 * себе, просто не должно быть способом спрятать запрещённую конструкцию). */
function decodeCssEscapes(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_match, hex?: string, literal?: string) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : (literal ?? ''),
  );
}

/** Второй барьер перед `allowedStyles` ниже: если раскрытый (см.
 * `decodeCssEscapes`) `style` содержит запрещённую конструкцию, вырезаем
 * атрибут целиком — раскрытое значение может больше не быть валидным CSS
 * для точечной правки одного свойства, поэтому не пытаемся сохранить
 * остальное. */
function stripUnsafeStyleAttribute(attribs: Record<string, string>): void {
  if (attribs.style && FORBIDDEN_STYLE_PATTERN.test(decodeCssEscapes(attribs.style))) {
    delete attribs.style;
  }
}

/** Свойства, которых достаточно для стилизованных карточек (градиенты/цвета/
 * рамки/тени/типографика/отступы) — `position` сознательно не включён:
 * `position: fixed/absolute` внутри поста в ленте — это уже вёрстка поверх
 * чужого интерфейса (clickjacking-подобный риск), а не оформление контента. */
const ALLOWED_STYLE_PROPERTIES = [
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'box-shadow',
  'text-shadow',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'text-decoration',
  'max-width',
  'width',
  'min-width',
  'opacity',
  'display',
  'gap',
  'justify-content',
  'align-items',
  'flex-direction',
  'box-sizing',
  'overflow-x',
  '-webkit-overflow-scrolling',
  'white-space',
  'border-collapse',
];

const ALLOWED_STYLES = Object.fromEntries(
  ALLOWED_STYLE_PROPERTIES.map((property) => [property, [SAFE_STYLE_VALUE]]),
);

/**
 * Единственное место, где HTML содержимого поста становится безопасным для
 * хранения и последующего `dangerouslySetInnerHTML` на frontend — вызывается
 * в `PostsService.create`/`update` перед записью в БД. Allowlist тегов —
 * форматирование из задачи (абзацы/переносы/жирный/курсив/подчёркивание/
 * заголовки/разделитель/контейнер с собственным оформлением/списки/ссылки/
 * картинки/таблицы/инлайновый span) + `style` на любом из них (см.
 * `ALLOWED_STYLE_PROPERTIES` выше) — без него стилизованные карточки и
 * таблицы, вставленные через HTML-режим редактора (см.
 * `features/publish-post/ui/PostEditor`, узлы `Table`/`Span` в
 * `rich-html-extensions.ts`), теряли бы всё оформление.
 */
export function sanitizePostContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'hr',
      'div',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'span',
    ],
    allowedAttributes: {
      // target/rel не приходят от клиента — их принудительно проставляет
      // transformTags ниже, но без них в allowlist sanitize-html вырезал бы
      // их обратно уже после трансформации.
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      table: ['role', 'cellpadding', 'cellspacing'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      '*': ['style'],
    },
    allowedStyles: {
      '*': ALLOWED_STYLES,
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      // Принудительно, независимо от того, что прислал клиент — открытие
      // внешней ссылки без noopener/noreferrer раскрывает `window.opener`
      // новой вкладке.
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true),
      // Применяется до `allowedStyles` ниже — см. `stripUnsafeStyleAttribute`
      // про то, зачем это отдельный шаг, а не только regex в `allowedStyles`.
      '*': (tagName, attribs) => {
        stripUnsafeStyleAttribute(attribs);
        return { tagName, attribs };
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'img' && !ALLOWED_IMAGE_SRC.test(frame.attribs.src ?? ''),
  });
}
