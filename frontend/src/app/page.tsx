import { redirect } from 'next/navigation';
// session.server.ts (server-only DAL) намеренно не реэкспортируется из
// features/auth/index.ts: барель может быть импортирован из клиентских
// компонентов, и server-only код в его графе сломает сборку. Импортируется
// по прямому пути только из Server Component.
// eslint-disable-next-line no-restricted-imports
import { getSessionUser } from '@/features/auth/api/session.server';
import { CurrentUserProvider } from '@/entities/user';
import { HomeApp } from './home-app';

/**
 * Единственный защищённый роут приложения. Проверка сессии здесь —
 * авторитетная (см. также оптимистичную проверку в `proxy.ts`): без валидной
 * cookie рендер даже не начинается. `initialUser` прокидывается пропом в
 * `CurrentUserProvider`, а не читается клиентским store, — так каждый запрос
 * получает свои данные без риска утечки между пользователями через общий
 * модульный store (см. AGENTS.md, раздел про auth).
 */
export default async function Home() {
  const currentUser = await getSessionUser();

  if (!currentUser) {
    // Не `redirect('/auth')` напрямую: cookie может присутствовать, но быть
    // недействительной на backend — см. комментарий в `src/proxy.ts` про
    // `/auth/clear` и почему без очистки cookie здесь возможен redirect loop.
    redirect('/auth/clear');
  }

  return (
    <CurrentUserProvider initialUser={currentUser}>
      <HomeApp />
    </CurrentUserProvider>
  );
}
