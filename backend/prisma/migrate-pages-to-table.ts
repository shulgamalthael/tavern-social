/**
 * Разовый backfill для миграции `20260825141926_add_website_pages` —
 * переносит `Website.draft.pages` (JSON-массив) в новую таблицу
 * `WebsitePage`, затем убирает ключ `pages` из `draft` (после переноса он
 * хранит только `{theme, settings}`, см. комментарий модели `Website` в
 * schema.prisma). `published` не трогает — см. комментарий внутри `main()`.
 * Идемпотентен на уровне САЙТА (не страницы): сайты, где `pages` в `draft`
 * уже отсутствует, пропускаются целиком — безопасно запускать повторно.
 * Новым строкам `WebsitePage` намеренно выдаётся свежий `id`, а не
 * переносится старый `page.id` из JSON — там он был уникален только в
 * рамках одного документа (у шаблона нового сайта это буквально всегда была
 * строка `'home'`, см. `default-website-document.ts`), а `WebsitePage.id`
 * теперь глобальный первичный ключ таблицы: у второго сайта с тем же старым
 * id была бы коллизия.
 *
 * Запуск: `npm run migrate-pages-to-table`
 * (или `docker compose exec backend npm run migrate-pages-to-table`).
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface LegacyPage {
  id: string;
  slug: string;
  title: string;
  blocks: unknown[];
}

interface LegacyDocument {
  pages?: LegacyPage[];
  theme?: unknown;
  settings?: unknown;
  [key: string]: unknown;
}

function stripPages(document: LegacyDocument): Prisma.InputJsonValue {
  return { theme: document.theme, settings: document.settings } as Prisma.InputJsonValue;
}

async function main() {
  const websites = await prisma.website.findMany({
    select: { id: true, draft: true },
  });

  let pagesCreated = 0;
  let websitesUpdated = 0;

  for (const website of websites) {
    const draft = website.draft as LegacyDocument;

    // Уже мигрирован (нет `pages` в draft) — пропускаем.
    if (!draft.pages) continue;

    const legacyPages = draft.pages;

    // `published` НЕ трогаем и НЕ переносим отдельно — это застывший снимок
    // прошлой публикации, больше никем не редактируется, и он останется
    // читаемым в старой форме (с `pages` внутри) ровно до следующего вызова
    // `publish()`, который в новой версии `WebsitesService` сам пересоберёт
    // его заново из свежих строк `WebsitePage` + актуальных `theme`/
    // `settings` — трогать его сейчас значило бы либо продублировать эту
    // логику здесь, либо рискнуть на мгновение показать посетителям сайт без
    // страниц, если что-то в скрипте пойдёт не так.
    await prisma.$transaction(async (tx) => {
      for (const [index, page] of legacyPages.entries()) {
        await tx.websitePage.create({
          data: {
            websiteId: website.id,
            slug: page.slug,
            title: page.title,
            content: (page.blocks ?? []) as Prisma.InputJsonValue,
            order: index,
          },
        });
        pagesCreated += 1;
      }

      await tx.website.update({
        where: { id: website.id },
        data: { draft: stripPages(draft) },
      });
      websitesUpdated += 1;
    });
  }

  // eslint-disable-next-line no-console -- CLI-скрипт, не серверный рантайм: вывод в консоль — ожидаемый UX.
  console.log(
    `Готово: ${websitesUpdated} сайт(ов) обновлено, ${pagesCreated} страниц(ы) перенесено в website_pages.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
