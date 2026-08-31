-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('free', 'starter', 'business', 'scale', 'enterprise');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'incomplete', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "PlanEventType" AS ENUM ('free_selected', 'checkout_started', 'checkout_completed', 'checkout_canceled', 'subscription_updated', 'subscription_canceled', 'enterprise_inquiry');

-- CreateTable
CREATE TABLE "business_subscriptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL DEFAULT 'free',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_selection_events" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "PlanEventType" NOT NULL,
    "tier" "PlanTier",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_selection_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_subscriptions_businessId_key" ON "business_subscriptions"("businessId");

-- CreateIndex
CREATE INDEX "plan_selection_events_businessId_idx" ON "plan_selection_events"("businessId");

-- CreateIndex
CREATE INDEX "plan_selection_events_createdAt_idx" ON "plan_selection_events"("createdAt");

-- AddForeignKey
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
