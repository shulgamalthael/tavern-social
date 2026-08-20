-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "repostOfId" TEXT,
ADD COLUMN     "repostsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "communities_name_idx" ON "communities" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "groups_name_idx" ON "groups" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "posts_authorId_repostOfId_key" ON "posts"("authorId", "repostOfId");

-- CreateIndex
CREATE INDEX "users_name_idx" ON "users" USING GIN ("name" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
