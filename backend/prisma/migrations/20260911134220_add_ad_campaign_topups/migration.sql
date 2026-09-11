-- CreateTable
CREATE TABLE "ad_campaign_topups" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaign_topups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_campaign_topups_campaignId_idx" ON "ad_campaign_topups"("campaignId");

-- AddForeignKey
ALTER TABLE "ad_campaign_topups" ADD CONSTRAINT "ad_campaign_topups_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
