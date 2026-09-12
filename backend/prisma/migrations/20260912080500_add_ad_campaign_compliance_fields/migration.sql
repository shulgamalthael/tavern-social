-- RenameColumn
ALTER TABLE "ad_campaigns" RENAME COLUMN "targetLocales" TO "targetCountries";

-- AlterTable
ALTER TABLE "ad_campaigns" ADD COLUMN     "isAdultContent" BOOLEAN NOT NULL DEFAULT false;
