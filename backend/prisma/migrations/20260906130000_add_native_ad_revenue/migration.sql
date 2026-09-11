-- CreateEnum
CREATE TYPE "NativeAdRevenueEventType" AS ENUM ('impression', 'click');

-- CreateTable
CREATE TABLE "native_ad_revenue_events" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "type" "NativeAdRevenueEventType" NOT NULL,
    "currency" TEXT NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "creatorShareCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "processingFeeCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "native_ad_revenue_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "native_ad_revenue_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "creatorRevenueShareBps" INTEGER NOT NULL DEFAULT 7000,
    "platformFeeBps" INTEGER NOT NULL DEFAULT 2500,
    "paymentProcessingFeeBps" INTEGER NOT NULL DEFAULT 500,
    "minimumPayoutCents" INTEGER NOT NULL DEFAULT 2000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "native_ad_revenue_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "native_ad_revenue_events_creatorProfileId_idx" ON "native_ad_revenue_events"("creatorProfileId");

-- CreateIndex
CREATE INDEX "native_ad_revenue_events_campaignId_idx" ON "native_ad_revenue_events"("campaignId");

-- AddForeignKey
ALTER TABLE "native_ad_revenue_events" ADD CONSTRAINT "native_ad_revenue_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "native_ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "native_ad_revenue_events" ADD CONSTRAINT "native_ad_revenue_events_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "native_ad_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "native_ad_revenue_events" ADD CONSTRAINT "native_ad_revenue_events_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the singleton settings row (fixed id 'default') so the app never
-- has to lazily create it on first read.
INSERT INTO "native_ad_revenue_settings" ("id", "updatedAt") VALUES ('default', now())
ON CONFLICT ("id") DO NOTHING;
