-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedReason" TEXT;
