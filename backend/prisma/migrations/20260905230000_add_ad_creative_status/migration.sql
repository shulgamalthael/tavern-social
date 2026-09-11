-- CreateEnum
CREATE TYPE "AdCreativeStatus" AS ENUM ('approved', 'rejected');

-- AlterTable
ALTER TABLE "ad_creatives"
  ADD COLUMN "status" "AdCreativeStatus" NOT NULL DEFAULT 'approved',
  ADD COLUMN "rejectionReason" TEXT;
