-- CreateEnum
CREATE TYPE "CustomWidgetStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "custom_widgets" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "status" "CustomWidgetStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_widgets_businessId_idx" ON "custom_widgets"("businessId");

-- AddForeignKey
ALTER TABLE "custom_widgets" ADD CONSTRAINT "custom_widgets_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

