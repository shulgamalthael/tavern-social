/**
 * Разовый backfill: до появления `LinkTarget`/`control: 'link'` (см.
 * `frontend/src/entities/website/model/resolve-link.ts`) поля-ссылки блоков
 * хранили голую строку (`buttonUrl: "#contact"`, `navLinks[].url: "#about"`
 * и т. п.) — тот же смысл, что раньше был у `control: 'url'`. `resolveLinkHref`
 * понимает только структурный `LinkTarget` (`{ type: 'anchor', anchor: '...' }`
 * и т. д.); голая строка не матчит ни один `case` и молча превращается в `#`
 * (см. её `default` — «битые данные не должны падать», но здесь это тихо
 * ломает РЕАЛЬНО РАБОТАВШИЕ ссылки на существующих опубликованных сайтах).
 * Этот скрипт конвертирует такие строки в эквивалентный `LinkTarget` прямо в
 * `WebsitePage.content` (единственное место, где живут блоки — см. комментарий
 * `migrate-pages-to-table.ts` про то, что `published` пересобирается заново
 * при каждой публикации из тех же строк, поэтому отдельно его трогать не
 * нужно).
 *
 * Список конвертируемых полей — ровно те, что получили `control: 'link'` в
 * реестре блоков (см. `grep -rn "control: 'link'" frontend/src/entities/
 * website/blocks`), продублирован здесь вручную (backend не импортирует
 * frontend-код, разные TS-проекты — тот же принцип, что и у `websites.types.ts`
 * vs `entities/website/model/types.ts`). Новое поле-ссылка в блоке — не
 * забудьте добавить его сюда, если у уже существующих сайтов может быть
 * голая строка в этом месте.
 *
 * Идемпотентен: конвертирует только реальные строки, уже структурный
 * `LinkTarget` (объект) не трогает — безопасно запускать повторно.
 *
 * Запуск: `npm run migrate-legacy-link-props`
 * (или `docker compose exec backend npm run migrate-legacy-link-props`).
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type LinkTarget =
  | { type: 'external'; url: string }
  | { type: 'page'; pageId: string }
  | { type: 'anchor'; anchor: string }
  | { type: 'phone'; phone: string }
  | { type: 'email'; email: string };

const TOP_LEVEL_LINK_FIELDS: Record<string, string[]> = {
  image: ['link'],
  hero: ['buttonUrl', 'secondaryUrl'],
  button: ['url'],
  link: ['url'],
  cta: ['buttonUrl'],
  banner: ['buttonUrl'],
};

const LIST_LINK_FIELDS: Record<string, { listKey: string; itemKey: string }[]> = {
  footer: [{ listKey: 'navLinks', itemKey: 'url' }],
  breadcrumbs: [{ listKey: 'items', itemKey: 'url' }],
  businessheader: [{ listKey: 'navLinks', itemKey: 'url' }],
  pricing: [{ listKey: 'plans', itemKey: 'buttonUrl' }],
  buttongroup: [{ listKey: 'buttons', itemKey: 'url' }],
  cards: [{ listKey: 'items', itemKey: 'url' }],
  articles: [{ listKey: 'items', itemKey: 'url' }],
};

function legacyStringToLinkTarget(value: string): LinkTarget {
  if (!value) return { type: 'external', url: '' };
  if (value.startsWith('#')) return { type: 'anchor', anchor: value.slice(1) };
  if (value.startsWith('tel:')) return { type: 'phone', phone: value.slice(4) };
  if (value.startsWith('mailto:')) return { type: 'email', email: value.slice(7) };
  return { type: 'external', url: value };
}

interface RawBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: RawBlock[];
  [key: string]: unknown;
}

/** Возвращает `true`, если хоть одно поле блока (рекурсивно вместе с
 * `children`) было сконвертировано — мутирует `block` на месте. */
function convertBlock(block: RawBlock): boolean {
  let changed = false;
  const props = block.props;

  if (props) {
    for (const key of TOP_LEVEL_LINK_FIELDS[block.type] ?? []) {
      const value = props[key];
      if (typeof value === 'string') {
        props[key] = legacyStringToLinkTarget(value);
        changed = true;
      }
    }

    for (const { listKey, itemKey } of LIST_LINK_FIELDS[block.type] ?? []) {
      const list = props[listKey];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && typeof item === 'object') {
            const value = (item as Record<string, unknown>)[itemKey];
            if (typeof value === 'string') {
              (item as Record<string, unknown>)[itemKey] = legacyStringToLinkTarget(value);
              changed = true;
            }
          }
        }
      }
    }
  }

  for (const child of block.children ?? []) {
    if (convertBlock(child)) changed = true;
  }

  return changed;
}

async function main() {
  const pages = await prisma.websitePage.findMany({
    select: { id: true, content: true },
  });

  let pagesUpdated = 0;

  for (const page of pages) {
    const blocks = page.content as unknown as RawBlock[];
    if (!Array.isArray(blocks)) continue;

    let pageChanged = false;
    for (const block of blocks) {
      if (convertBlock(block)) pageChanged = true;
    }

    if (pageChanged) {
      await prisma.websitePage.update({
        where: { id: page.id },
        data: { content: blocks as unknown as Prisma.InputJsonValue },
      });
      pagesUpdated += 1;
    }
  }

  // eslint-disable-next-line no-console -- CLI-скрипт, не серверный рантайм: вывод в консоль — ожидаемый UX.
  console.log(`Готово: ${pagesUpdated} страниц(ы) обновлено (голые строки → LinkTarget).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
