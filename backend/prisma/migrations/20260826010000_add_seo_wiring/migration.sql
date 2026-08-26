-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "website_pages" ADD COLUMN     "ogImage" TEXT;

