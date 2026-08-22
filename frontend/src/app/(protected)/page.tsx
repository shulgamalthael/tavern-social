import { HomeApp } from '../home-app';

/**
 * Сессия уже проверена в `(protected)/layout.tsx` (см. AGENTS.md, раздел
 * про auth) — здесь остаётся только сама SPA-оболочка.
 */
export default function Home() {
  return <HomeApp />;
}
