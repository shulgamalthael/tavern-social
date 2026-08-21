-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('open', 'private');

-- AlterEnum (PG12+ разрешает использовать новые значения вне той же
-- транзакции, что их добавила — здесь они и не используются, только
-- добавляются)
ALTER TYPE "NotificationType" ADD VALUE 'group_join_request';
ALTER TYPE "NotificationType" ADD VALUE 'group_join_accepted';

-- Group: meta -> description (данные переносятся как есть), mark
-- дропается (заменяется обычным Avatar с инициалами на frontend), + type/
-- avatarUrl/coverUrl/membersCount.
ALTER TABLE "groups" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
UPDATE "groups" SET "description" = "meta";
ALTER TABLE "groups" DROP COLUMN "meta";
ALTER TABLE "groups" DROP COLUMN "mark";
ALTER TABLE "groups" ADD COLUMN "type" "GroupType" NOT NULL DEFAULT 'open';
-- Существующие (сид) группы были задуманы как «только по приглашению» (см.
-- старый комментарий GroupsService) — сохраняем это как `private`, а не
-- отдаём им новый дефолт `open`, который относится только к вновь
-- создаваемым группам.
UPDATE "groups" SET "type" = 'private';
ALTER TABLE "groups" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "groups" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "groups" ADD COLUMN "membersCount" INTEGER NOT NULL DEFAULT 0;

-- Бэкфилл membersCount из реального числа участников — дальше сервис
-- поддерживает счётчик сам (increment/decrement при join/leave), как и
-- Community.membersCount.
UPDATE "groups" g
SET "membersCount" = (SELECT COUNT(*) FROM "group_memberships" gm WHERE gm."groupId" = g."id");

-- GroupMembership.role: свободный текст-«титул» ("Хранитель стола",
-- "Участник", "Проводник" — см. seed.ts) становится реальным permission-
-- enum. Эвристика: строки, содержащие "участник" (без учёта регистра) —
-- обычный участник, всё остальное — трактуем как условного «владельца»
-- (в существующих 3 сид-строках это как раз создатели/хранители столов).
-- Decorative-текст не переживает миграцию — см. план по группам, это
-- dev-only seed-данные, не production.
ALTER TABLE "group_memberships" ADD COLUMN "role_new" "GroupRole" NOT NULL DEFAULT 'member';
UPDATE "group_memberships"
SET "role_new" = CASE
  WHEN "role" ILIKE '%участник%' THEN 'member'::"GroupRole"
  ELSE 'owner'::"GroupRole"
END;
ALTER TABLE "group_memberships" DROP COLUMN "role";
ALTER TABLE "group_memberships" RENAME COLUMN "role_new" TO "role";

-- CreateTable
CREATE TABLE "group_join_requests" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_join_requests_groupId_idx" ON "group_join_requests"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "group_join_requests_groupId_userId_key" ON "group_join_requests"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Post: groupId (пост в группе) + wallOwnerId становится опциональным —
-- ровно одно из двух заполнено (проверяется в PostsService.create, не в БД).
ALTER TABLE "posts" ADD COLUMN "groupId" TEXT;
ALTER TABLE "posts" ALTER COLUMN "wallOwnerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notification: groupId — для group_join_request/group_join_accepted.
ALTER TABLE "notifications" ADD COLUMN "groupId" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
