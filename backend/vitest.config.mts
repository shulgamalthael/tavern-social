import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Минимальная конфигурация Vitest — тот же принцип, что у
 * `frontend/vitest.config.mts` (Currency System, ROADMAP.md §8): только
 * юнит-тесты для чистых функций без БД/NestJS DI/сети (Pricing Engine,
 * `PRICING_ARCHITECTURE.md` — `calculateOrderPricing`/`checkDiscountEligibility`).
 * Всё остальное на backend проверяется живыми E2E-скриптами против
 * реального запущенного сервера (см. `AGENTS.md`) — это не замена той
 * практике, а покрытие ровно того, для чего юнит-тесты действительно
 * подходят.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
