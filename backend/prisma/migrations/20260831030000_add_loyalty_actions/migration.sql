-- AlterEnum
ALTER TYPE "RuleActionType" ADD VALUE 'add_loyalty_points';
ALTER TYPE "RuleActionType" ADD VALUE 'set_membership_tier';

-- CreateTable
CREATE TABLE "customer_loyalty_accounts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_loyalty_accounts_businessId_email_key" ON "customer_loyalty_accounts"("businessId", "email");

-- AddForeignKey
ALTER TABLE "customer_loyalty_accounts" ADD CONSTRAINT "customer_loyalty_accounts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
