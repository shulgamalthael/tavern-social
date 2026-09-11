-- CreateEnum
CREATE TYPE "CreatorStripeConnectStatus" AS ENUM ('not_connected', 'onboarding', 'active');

-- CreateEnum
CREATE TYPE "NativeAdPayoutStatus" AS ENUM ('pending', 'paid', 'failed');

-- AlterTable
ALTER TABLE "creator_profiles" ADD COLUMN     "stripeConnectStatus" "CreatorStripeConnectStatus" NOT NULL DEFAULT 'not_connected',
ADD COLUMN     "stripeConnectedAccountId" TEXT;

-- AlterTable
ALTER TABLE "native_ad_revenue_events" ADD COLUMN     "payoutId" TEXT;

-- CreateTable
CREATE TABLE "native_ad_payouts" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "NativeAdPayoutStatus" NOT NULL DEFAULT 'pending',
    "stripeTransferId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "native_ad_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "native_ad_payouts_creatorProfileId_idx" ON "native_ad_payouts"("creatorProfileId");

-- CreateIndex
CREATE INDEX "native_ad_payouts_status_idx" ON "native_ad_payouts"("status");

-- CreateIndex
CREATE INDEX "native_ad_revenue_events_payoutId_idx" ON "native_ad_revenue_events"("payoutId");

-- AddForeignKey
ALTER TABLE "native_ad_revenue_events" ADD CONSTRAINT "native_ad_revenue_events_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "native_ad_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "native_ad_payouts" ADD CONSTRAINT "native_ad_payouts_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

