-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "formLabel" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_submissions_businessId_createdAt_idx" ON "form_submissions"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

