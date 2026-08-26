import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Минимальная конфигурация Vitest — только юнит-тесты для чистых функций
 * без React/DOM/backend (Currency System, ROADMAP.md §8: `formatMoney`/
 * `toMinorUnits`/`fromMinorUnits`, денежная арифметика). Всё остальное в
 * проекте проверяется реальными E2E-скриптами против живого backend (см.
 * `AGENTS.md`/практику этого проекта) — юнит-тесты здесь не заменяют это,
 * а покрывают ровно то, для чего они действительно подходят: чистую
 * математику форматирования денег с быстрой обратной связью, без БД/сети.
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
