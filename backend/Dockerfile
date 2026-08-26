# Единый multi-stage Dockerfile для backend: `development` — для
# docker-compose с bind-mount исходников и watch mode (см. AGENTS.md backend,
# раздел про Docker), `production` — минимальный образ из собранного build.
# Полный workflow и объяснение стадий — README.md в корне репозитория.

FROM node:22-bookworm-slim AS base
# openssl нужен Prisma query-engine на Debian; ca-certificates — для https-запросов рантайма.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------
# development — образ для `docker compose up`. Исходники монтируются volume'ом
# поверх этого слоя (см. docker-compose.yml) — COPY . . здесь нужен только
# для первого запуска до подключения bind mount и для `docker build` без compose.
# ---------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
# node:22-bookworm-slim уже содержит пользователя node с uid/gid 1000, что
# совпадает с обычным первым пользователем на Linux-хосте. Без этого процесс
# в контейнере работает от root, и всё, что watch mode пишет в bind-mount
# (dist/, .tsbuildinfo), оказывается на хосте с владельцем root — хост-пользователь
# не может это ни отредактировать, ни удалить без sudo.
RUN chown -R node:node /app
USER node
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# build — компилирует TypeScript в dist/ с полным набором зависимостей.
# ---------------------------------------------------------------------------
FROM base AS build
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# production-dependencies — только runtime-зависимости + сгенерированный
# Prisma Client поверх них (генерация зависит от того, что реально попадёт
# в финальный образ, поэтому повторяется после `npm ci --omit=dev`).
# ---------------------------------------------------------------------------
FROM base AS production-dependencies
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---------------------------------------------------------------------------
# production — минимальный образ: только dist/, runtime node_modules и схема
# Prisma (нужна migration engine для `prisma migrate deploy` при выкладке).
# Никакого bind mount, никаких dev-зависимостей.
# ---------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
COPY package.json ./
COPY docker ./docker
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "docker/healthcheck.js"]

CMD ["node", "dist/main.js"]
