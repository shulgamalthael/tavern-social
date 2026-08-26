/** Матчит один «пиктографический» символ Unicode — эмодзи (не любой символ
 * вообще, буквы/цифры/пунктуация сюда не попадают). */
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}/u;

/** Не больше стольких эмодзи-графем подряд ещё считаются «стикером» (см.
 * `widgets/messenger/ui/MessageBubble.tsx`) — сообщение из одного-трёх
 * эмодзи без текста рендерится крупно и без пузыря, как в Telegram/WhatsApp;
 * длинная эмодзи-строка — уже обычное сообщение, не стикер. */
const MAX_STICKER_GRAPHEMES = 3;

/**
 * Сообщение — «стикер» (см. выше), если после `trim()` в нём только эмодзи
 * (1-3 штуки) и больше ничего. Разбивка на графемы через `Intl.Segmenter` —
 * обычный `.length`/посимвольный regex ненадёжен для составных эмодзи
 * (ZWJ-последовательности, тон кожи — они физически несколько code units
 * или даже несколько code points, но одна графема, один зрительный символ).
 */
export function isEmojiOnlyText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const graphemes = Array.from(segmenter.segment(trimmed), (entry) => entry.segment);

  if (graphemes.length === 0 || graphemes.length > MAX_STICKER_GRAPHEMES) return false;
  return graphemes.every((grapheme) => EMOJI_GRAPHEME.test(grapheme));
}
