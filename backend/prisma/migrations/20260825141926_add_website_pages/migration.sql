-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('custom', 'system');

-- CreateTable
CREATE TABLE "website_pages" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PageType" NOT NULL DEFAULT 'custom',
    "systemKey" TEXT,
    "content" JSONB NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_pages_websiteId_order_idx" ON "website_pages"("websiteId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_websiteId_slug_key" ON "website_pages"("websiteId", "slug");

-- AddForeignKey
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

