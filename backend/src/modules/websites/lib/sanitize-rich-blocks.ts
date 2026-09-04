import { sanitizeRichBlockText } from '@/common/lib/sanitize-rich-block-text';
import type { WebsiteBlock } from '../websites.types';

/** Три типа блоков, чьё поле `props.text` — форматированный HTML (жирный/
 * курсив/ссылка через `EditableRichText`, `entities/website/ui/` на
 * frontend), не обычная строка — единственные, кого касается эта функция.
 * Backend по-прежнему не знает всю схему блоков (см. `WebsitesService.
 * validatePages`'s комментарий про то, что форма `props` намеренно не
 * парсится) — это точечное правило для конкретных трёх типов, а не общий
 * парсер. */
export const RICH_TEXT_BLOCK_TYPES = new Set(['text', 'richtext', 'quote']);

/** Рекурсивно проходит дерево блоков (включая `children` — блоки могут
 * лежать внутри `section`/`container`/`columns`/`column`) и для типов из
 * `RICH_TEXT_BLOCK_TYPES` прогоняет `props.text` через `sanitizeRichBlock
 * Text` — единственное место, где HTML в этом поле становится безопасным
 * для `dangerouslySetInnerHTML` на frontend (тот же принцип, что и
 * `sanitizePostContent` в `PostsService.create/update`). Вызывается
 * `WebsitesService.saveDraft` ДО записи в БД — `publish()` содержимое не
 * переписывает, только переснимает уже сохранённые (уже прошедшие эту
 * санитизацию) страницы, поэтому второй вызов там не нужен. Чистая функция
 * без NestJS-зависимостей — тот же приём, что и `uploads-retention.lib.ts`/
 * `block-tree.ts`, ради юнит-тестируемости без моков Prisma. */
export function sanitizeRichBlocks(blocks: WebsiteBlock[]): WebsiteBlock[] {
  return blocks.map((block) => {
    const sanitized: WebsiteBlock = { ...block };

    if (RICH_TEXT_BLOCK_TYPES.has(block.type) && typeof block.props.text === 'string') {
      sanitized.props = { ...block.props, text: sanitizeRichBlockText(block.props.text) };
    }
    if (block.children) {
      sanitized.children = sanitizeRichBlocks(block.children);
    }

    return sanitized;
  });
}
