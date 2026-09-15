#!/usr/bin/env bash
# Восстанавливает Postgres из бэкапа, сделанного scripts/db-backup.sh.
# Использование: ./scripts/db-restore.sh [путь_к_дампу]   (по умолчанию backups/latest.dump)
# ВНИМАНИЕ: перезаписывает текущую базу tavern (pg_restore -c дропает существующие объекты).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

CONTAINER=tavern-postgres-1
DB_USER=tavern
DB_NAME=tavern
DUMP_FILE="${1:-backups/latest.dump}"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Файл дампа не найден: $DUMP_FILE" >&2
  exit 1
fi

# latest.dump — симлинк; docker cp копирует ссылки как есть, а не их цель,
# поэтому путь нужно разыменовать перед копированием в контейнер.
DUMP_FILE="$(readlink -f "$DUMP_FILE")"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Контейнер $CONTAINER не запущен. Запустите: docker compose up -d postgres" >&2
  exit 1
fi

BASENAME="$(basename "$DUMP_FILE")"
docker cp "$DUMP_FILE" "$CONTAINER:/tmp/$BASENAME"
docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" -c --if-exists "/tmp/$BASENAME"
docker exec "$CONTAINER" rm -f "/tmp/$BASENAME"

echo "База $DB_NAME восстановлена из $DUMP_FILE"
