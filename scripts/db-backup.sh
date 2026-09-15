#!/usr/bin/env bash
# Делает бэкап Postgres из dev-контейнера (docker-compose.yml, сервис `postgres`)
# в один файл custom-формата pg_dump — восстанавливается одной командой
# через scripts/db-restore.sh (pg_restore -c).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

CONTAINER=tavern-postgres-1
DB_USER=tavern
DB_NAME=tavern
OUT_DIR=backups
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${OUT_DIR}/tavern_${TIMESTAMP}.dump"

mkdir -p "$OUT_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Контейнер $CONTAINER не запущен. Запустите: docker compose up -d postgres" >&2
  exit 1
fi

docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "/tmp/$(basename "$OUT_FILE")"
docker cp "$CONTAINER:/tmp/$(basename "$OUT_FILE")" "$OUT_FILE"
docker exec "$CONTAINER" rm -f "/tmp/$(basename "$OUT_FILE")"

ln -sf "$(basename "$OUT_FILE")" "${OUT_DIR}/latest.dump"

echo "Бэкап сохранён: $OUT_FILE"
echo "Восстановить:   ./scripts/db-restore.sh $OUT_FILE"
