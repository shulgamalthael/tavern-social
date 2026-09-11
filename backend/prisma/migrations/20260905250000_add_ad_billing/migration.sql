-- CreateEnum
CREATE TYPE "AdBillingModel" AS ENUM ('cpm', 'cpc');

-- AlterTable
-- Backfill existing rows with a placeholder (cpm, $1 CPM) via DEFAULT, then
-- drop the default so new rows must supply it explicitly (matches the
-- Prisma schema, which declares no @default for these two columns).
ALTER TABLE "ad_campaigns"
  ADD COLUMN "billingModel" "AdBillingModel" NOT NULL DEFAULT 'cpm',
  ADD COLUMN "bidCents" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "impressionsServed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clicksServed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ad_campaigns" ALTER COLUMN "billingModel" DROP DEFAULT;
ALTER TABLE "ad_campaigns" ALTER COLUMN "bidCents" DROP DEFAULT;
