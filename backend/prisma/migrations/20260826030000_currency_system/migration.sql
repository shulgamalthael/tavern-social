-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'RUB';

-- AlterTable
ALTER TABLE "products" DROP COLUMN "currency";

-- AlterTable
ALTER TABLE "services" DROP COLUMN "currency";

