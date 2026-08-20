import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';

// Feature-Sliced Design: направление зависимостей "снизу вверх".
// Слой может импортировать только нижестоящие слои и обязан заходить в них
// через публичный API слайса (index.ts), а не во внутренние файлы.
// См. раздел "Архитектура" в AGENTS.md.
const fsdLayerOrder = ['shared', 'entities', 'features', 'widgets', 'app'];

const fsdBoundaryConfigs = fsdLayerOrder.map((layer, index) => {
  const higherLayers = fsdLayerOrder.slice(index + 1);
  const patterns = [
    {
      group: ['@/entities/*/**', '@/features/*/**', '@/widgets/*/**'],
      message:
        'Импортируйте слайсы FSD только через их публичный API (index.ts) — не заходите во внутренние файлы слайса.',
    },
  ];

  if (higherLayers.length > 0) {
    patterns.push({
      group: higherLayers.map((higherLayer) => `@/${higherLayer}/**`),
      message: `Слой "${layer}" не может зависеть от вышестоящих слоёв FSD (${higherLayers.join(', ')}).`,
    });
  }

  return {
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns }],
    },
  };
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Отключает стилистические правила ESLint, конфликтующие с Prettier.
  // Форматирование — зона ответственности Prettier (см. `npm run format`).
  eslintConfigPrettier,
  {
    rules: {
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      curly: ['error', 'multi-line'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react/self-closing-comp': 'warn',
      'import/no-cycle': 'warn',
      // any допустим только с осознанным обоснованием — используйте
      // `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- почему`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
    },
  },
  ...fsdBoundaryConfigs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Временная папка-источник компонентов — не часть проекта, см. AGENTS.md.
    'temp/**',
  ]),
]);

export default eslintConfig;
