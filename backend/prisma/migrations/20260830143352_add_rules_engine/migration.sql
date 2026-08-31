-- CreateEnum
CREATE TYPE "RuleTrigger" AS ENUM ('order_completed');

-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('send_notification');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'order_received';

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "actorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "RuleTrigger" NOT NULL,
    "condition" JSONB,
    "actions" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_execution_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "trigger" "RuleTrigger" NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "actionsRun" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rules_businessId_trigger_isEnabled_idx" ON "rules"("businessId", "trigger", "isEnabled");

-- CreateIndex
CREATE INDEX "rule_execution_logs_businessId_createdAt_idx" ON "rule_execution_logs"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "rule_execution_logs_ruleId_createdAt_idx" ON "rule_execution_logs"("ruleId", "createdAt");

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_execution_logs" ADD CONSTRAINT "rule_execution_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

