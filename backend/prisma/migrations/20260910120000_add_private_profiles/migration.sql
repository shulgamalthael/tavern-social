-- AlterTable
ALTER TABLE "users" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'subscription_request';
ALTER TYPE "NotificationType" ADD VALUE 'subscription_accepted';

-- CreateTable
CREATE TABLE "subscription_requests" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_requests_receiverId_idx" ON "subscription_requests"("receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_requests_senderId_receiverId_key" ON "subscription_requests"("senderId", "receiverId");

-- AddForeignKey
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
