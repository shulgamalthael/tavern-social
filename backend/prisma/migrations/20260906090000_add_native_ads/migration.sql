-- CreateEnum
CREATE TYPE "NativeAdCampaignStatus" AS ENUM ('draft', 'pending_review', 'active', 'paused', 'rejected', 'completed');

-- CreateEnum
CREATE TYPE "NativeAdCreativeStyle" AS ENUM ('minimal', 'editorial', 'product', 'video');

-- CreateEnum
CREATE TYPE "NativeAdCreativeStatus" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "NativeAdAssignmentStatus" AS ENUM ('active', 'paused');

-- CreateTable
CREATE TABLE "native_ad_campaigns" (
    "id" TEXT NOT NULL,
    "advertiserBusinessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "NativeAdCampaignStatus" NOT NULL DEFAULT 'draft',
    "rejectionReason" TEXT,
    "budgetCents" INTEGER NOT NULL,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "billingModel" "AdBillingModel" NOT NULL,
    "bidCents" INTEGER NOT NULL,
    "impressionsServed" INTEGER NOT NULL DEFAULT 0,
    "clicksServed" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "stripePaymentIntentId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "targetCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetGeography" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "native_ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "native_ad_creatives" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "style" "NativeAdCreativeStyle" NOT NULL,
    "headline" TEXT NOT NULL,
    "bodyText" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "ctaLabel" TEXT,
    "targetUrl" TEXT NOT NULL,
    "status" "NativeAdCreativeStatus" NOT NULL DEFAULT 'approved',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "native_ad_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "native_ad_assignments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "status" "NativeAdAssignmentStatus" NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "native_ad_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "native_ad_campaigns_advertiserBusinessId_idx" ON "native_ad_campaigns"("advertiserBusinessId");

-- CreateIndex
CREATE INDEX "native_ad_campaigns_status_idx" ON "native_ad_campaigns"("status");

-- CreateIndex
CREATE INDEX "native_ad_creatives_campaignId_idx" ON "native_ad_creatives"("campaignId");

-- CreateIndex
CREATE INDEX "native_ad_assignments_creatorProfileId_idx" ON "native_ad_assignments"("creatorProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "native_ad_assignments_campaignId_creatorProfileId_key" ON "native_ad_assignments"("campaignId", "creatorProfileId");

-- AddForeignKey
ALTER TABLE "native_ad_campaigns" ADD CONSTRAINT "native_ad_campaigns_advertiserBusinessId_fkey" FOREIGN KEY ("advertiserBusinessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "native_ad_creatives" ADD CONSTRAINT "native_ad_creatives_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "native_ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "native_ad_assignments" ADD CONSTRAINT "native_ad_assignments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "native_ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "native_ad_assignments" ADD CONSTRAINT "native_ad_assignments_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

