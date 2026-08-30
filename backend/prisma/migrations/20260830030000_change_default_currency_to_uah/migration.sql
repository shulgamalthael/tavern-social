-- Currency System default changes from RUB to UAH (RUB removed from
-- SUPPORTED_CURRENCIES entirely, see backend/src/modules/currencies/currencies.ts).
-- Backfill any existing RUB rows first so no row is left referencing a
-- currency code that no longer exists in the supported list, then flip the
-- column defaults for future rows.

UPDATE "businesses" SET "currency" = 'UAH' WHERE "currency" = 'RUB';
UPDATE "orders" SET "currency" = 'UAH' WHERE "currency" = 'RUB';
UPDATE "appointments" SET "currency" = 'UAH' WHERE "currency" = 'RUB';

ALTER TABLE "businesses" ALTER COLUMN "currency" SET DEFAULT 'UAH';
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'UAH';
ALTER TABLE "appointments" ALTER COLUMN "currency" SET DEFAULT 'UAH';
