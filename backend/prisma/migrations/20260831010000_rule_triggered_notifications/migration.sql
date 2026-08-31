-- Rename to reflect that this notification type now covers all Business
-- Logic Engine triggers (order_completed/appointment_booked/form_submitted),
-- not just orders. Safe: 0 rows of this type existed at migration time.
ALTER TYPE "NotificationType" RENAME VALUE 'order_received' TO 'rule_triggered';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "businessId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "summary" TEXT;

-- CreateIndex
CREATE INDEX "notifications_businessId_createdAt_idx" ON "notifications"("businessId", "createdAt");
