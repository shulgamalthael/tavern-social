-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "post_images" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_previews" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "domain" TEXT,
    "status" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_previews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_images_postId_order_idx" ON "post_images"("postId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "link_previews_url_key" ON "link_previews"("url");

-- AddForeignKey
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: posts.text становится санитизированным HTML-полем
-- (см. common/lib/sanitize-post-content.ts) — существующий текст
-- экранируем, чтобы он остался тем же видимым текстом, а не превратился в
-- случайную HTML-разметку из-за символов вроде "<"/"&".
UPDATE "posts"
SET "text" = replace(replace(replace(replace(replace("text", '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');

-- Фото постов, автосозданных при загрузке в галерею (Post.imageUrl),
-- переносим внутрь текста как обычный <img> в конце контента — теперь это
-- единственное представление и текста, и картинок поста — и заводим
-- учётную строку post_images для того же файла (см. комментарий модели
-- PostImage в schema.prisma).
INSERT INTO "post_images" ("id", "postId", "url", "order", "createdAt")
SELECT gen_random_uuid()::text, "id", "imageUrl", 0, "createdAt"
FROM "posts"
WHERE "imageUrl" IS NOT NULL;

UPDATE "posts"
SET "text" = "text" || '<img src="' || "imageUrl" || '" alt="">'
WHERE "imageUrl" IS NOT NULL;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "imageUrl";
