-- CreateTable
CREATE TABLE "custom_widget_catalog_inserts" (
    "id" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_widget_catalog_inserts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_widget_catalog_inserts_widgetId_businessId_key" ON "custom_widget_catalog_inserts"("widgetId", "businessId");

-- AddForeignKey
ALTER TABLE "custom_widget_catalog_inserts" ADD CONSTRAINT "custom_widget_catalog_inserts_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "custom_widgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_widget_catalog_inserts" ADD CONSTRAINT "custom_widget_catalog_inserts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
