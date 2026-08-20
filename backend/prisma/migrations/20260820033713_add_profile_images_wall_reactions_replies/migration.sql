-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('like', 'dislike');

-- DropForeignKey
ALTER TABLE "post_likes" DROP CONSTRAINT "post_likes_postId_fkey";

-- DropForeignKey
ALTER TABLE "post_likes" DROP CONSTRAINT "post_likes_userId_fkey";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "parentId" TEXT;

-- AlterTable
-- wallOwnerId начинается как nullable — существующие 38 строк бэкфилятся
-- ниже из authorId (каждый пост сегодня и так "на своей стене"), затем
-- колонка становится NOT NULL. Так Postgres не требует constant default
-- для обязательной колонки на непустой таблице.
ALTER TABLE "posts" ADD COLUMN     "dislikesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "wallOwnerId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "coverUrl" TEXT;

-- CreateTable
CREATE TABLE "gallery_images" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL DEFAULT 'like',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gallery_images_userId_createdAt_idx" ON "gallery_images"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_postId_userId_key" ON "post_reactions"("postId", "userId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "posts_wallOwnerId_createdAt_idx" ON "posts"("wallOwnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_wallOwnerId_fkey" FOREIGN KEY ("wallOwnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: backfill wallOwnerId from authorId — every existing post is
-- on its own author's wall today.
UPDATE "posts" SET "wallOwnerId" = "authorId" WHERE "wallOwnerId" IS NULL;

-- DataMigration: carry existing likes over into the unified reaction table
-- before dropping post_likes, so no like history is lost.
INSERT INTO "post_reactions" ("id", "postId", "userId", "type", "createdAt")
SELECT "id", "postId", "userId", 'like', "createdAt" FROM "post_likes";

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "wallOwnerId" SET NOT NULL;

-- DropTable
DROP TABLE "post_likes";
