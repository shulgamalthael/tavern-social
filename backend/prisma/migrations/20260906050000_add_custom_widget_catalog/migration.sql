-- AlterTable
ALTER TABLE "custom_widgets"
  ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sharedAt" TIMESTAMP(3),
  ADD COLUMN "schemaHash" TEXT,
  ADD COLUMN "catalogInsertCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "custom_widgets_isShared_idx" ON "custom_widgets"("isShared");

-- CreateIndex
CREATE INDEX "custom_widgets_schemaHash_idx" ON "custom_widgets"("schemaHash");
