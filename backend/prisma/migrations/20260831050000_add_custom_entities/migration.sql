-- CreateTable
CREATE TABLE "custom_entities" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_entity_records" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_entity_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_entities_businessId_idx" ON "custom_entities"("businessId");

-- CreateIndex
CREATE INDEX "custom_entity_records_entityId_idx" ON "custom_entity_records"("entityId");

-- AddForeignKey
ALTER TABLE "custom_entities" ADD CONSTRAINT "custom_entities_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_entity_records" ADD CONSTRAINT "custom_entity_records_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "custom_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
