-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'creator_status_changed';

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('verification_pending', 'verified', 'active', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "CreatorAdFrequency" AS ENUM ('low', 'balanced', 'high');

-- CreateTable
CREATE TABLE "creator_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "creator_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_category_assignments" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "creator_category_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CreatorStatus" NOT NULL DEFAULT 'verification_pending',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "stripeIdentitySessionId" TEXT,
    "monetizationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adFrequency" "CreatorAdFrequency" NOT NULL DEFAULT 'balanced',
    "maxAdFrequencyRatio" INTEGER NOT NULL DEFAULT 5,
    "blockedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedAdvertiserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_categories_slug_key" ON "creator_categories"("slug");

-- CreateIndex
CREATE INDEX "creator_categories_parentId_idx" ON "creator_categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_category_assignments_creatorProfileId_categoryId_key" ON "creator_category_assignments"("creatorProfileId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_profiles_userId_key" ON "creator_profiles"("userId");

-- AddForeignKey
ALTER TABLE "creator_categories" ADD CONSTRAINT "creator_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "creator_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_category_assignments" ADD CONSTRAINT "creator_category_assignments_creatorProfileId_fkey" FOREIGN KEY ("creatorProfileId") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_category_assignments" ADD CONSTRAINT "creator_category_assignments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "creator_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
