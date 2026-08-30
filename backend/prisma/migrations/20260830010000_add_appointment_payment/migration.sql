-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_stripePaymentIntentId_key" ON "appointments"("stripePaymentIntentId");
