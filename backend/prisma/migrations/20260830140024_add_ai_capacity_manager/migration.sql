-- CreateEnum
CREATE TYPE "AiPriority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('success', 'failed', 'rate_limited');

-- CreateEnum
CREATE TYPE "AiBudgetScope" AS ENUM ('global', 'business');

-- CreateEnum
CREATE TYPE "AiAlertSeverity" AS ENUM ('warning', 'critical', 'emergency');

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "priority" "AiPriority" NOT NULL,
    "businessId" TEXT,
    "actorId" TEXT,
    "model" TEXT NOT NULL,
    "status" "AiRequestStatus" NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "costMicros" INTEGER,
    "latencyMs" INTEGER,
    "rpmUsedPercent" INTEGER,
    "rpdUsedPercent" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_daily_aggregates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "businessId" TEXT,
    "operation" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_daily_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_capacity_snapshots" (
    "id" TEXT NOT NULL,
    "rpmUsed" INTEGER NOT NULL,
    "rpmSafetyLimit" INTEGER NOT NULL,
    "rpmOfficialLimit" INTEGER NOT NULL,
    "rpdUsed" INTEGER NOT NULL,
    "rpdSafetyLimit" INTEGER NOT NULL,
    "rpdOfficialLimit" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_capacity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_budgets" (
    "id" TEXT NOT NULL,
    "scope" "AiBudgetScope" NOT NULL,
    "businessId" TEXT,
    "monthlyLimitCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_alerts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "AiAlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "ai_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_anomalies" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_request_logs_createdAt_idx" ON "ai_request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_request_logs_businessId_createdAt_idx" ON "ai_request_logs"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_request_logs_operation_createdAt_idx" ON "ai_request_logs"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "ai_request_logs_status_createdAt_idx" ON "ai_request_logs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_daily_aggregates_date_idx" ON "ai_usage_daily_aggregates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_daily_aggregates_date_businessId_operation_key" ON "ai_usage_daily_aggregates"("date", "businessId", "operation");

-- CreateIndex
CREATE INDEX "ai_capacity_snapshots_createdAt_idx" ON "ai_capacity_snapshots"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_budgets_scope_businessId_key" ON "ai_budgets"("scope", "businessId");

-- CreateIndex
CREATE INDEX "ai_alerts_createdAt_idx" ON "ai_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "ai_anomalies_detectedAt_idx" ON "ai_anomalies"("detectedAt");

-- CreateIndex
CREATE INDEX "ai_recommendations_createdAt_idx" ON "ai_recommendations"("createdAt");

