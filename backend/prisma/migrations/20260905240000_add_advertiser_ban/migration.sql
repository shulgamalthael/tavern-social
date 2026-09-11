-- CreateTable
CREATE TABLE "advertiser_bans" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertiser_bans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advertiser_bans_businessId_key" ON "advertiser_bans"("businessId");

-- AddForeignKey
ALTER TABLE "advertiser_bans" ADD CONSTRAINT "advertiser_bans_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
