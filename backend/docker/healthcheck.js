// Использует глобальный fetch (Node 18+) — без лишних зависимостей.
// Общий healthcheck-скрипт для Dockerfile (production) и docker-compose.yml (dev).
fetch('http://localhost:4000/health')
  .then((response) => process.exit(response.ok ? 0 : 1))
  .catch(() => process.exit(1));
