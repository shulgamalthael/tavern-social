-- AlterEnum
ALTER TYPE "AdFormat" ADD VALUE 'video';

-- AlterTable
ALTER TABLE "ad_creatives" ADD COLUMN "videoUrl" TEXT;
