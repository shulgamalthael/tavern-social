-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('none', 'inclusive', 'exclusive');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "taxMode" "TaxMode" NOT NULL DEFAULT 'none',
ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountName" TEXT,
ADD COLUMN     "subtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minOrderAmountCents" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discounts_businessId_idx" ON "discounts"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_businessId_code_key" ON "discounts"("businessId", "code");

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: existing orders predate discounts/tax entirely (paymentStatus/
-- totalCents already reflect a world with neither) — their subtotal is
-- simply their total, not the column default of 0.
UPDATE "orders" SET "subtotalCents" = "totalCents" WHERE "subtotalCents" = 0;
