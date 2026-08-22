import { redirect } from 'next/navigation';
// session.server.ts (server-only DAL) намеренно не реэкспортируется из
// features/auth/index.ts: барель может быть импортирован из клиентских
// компонентов, и server-only код в его графе сломает сборку. Импортируется
// по прямому пути только из Server Component.
// eslint-disable-next-line no-restricted-imports
import { getSessionUser } from '@/features/auth/api/session.server';
import { CurrentUserProvider } from '@/entities/user';

/**
 * Общий рубеж для всех защищённых маршрутов (сейчас `/` и `/admin`, см.
 * AGENTS.md, раздел про auth — «если появится больше защищённых маршрутов,
 * поднимите этот паттерн в (protected)/layout.tsx»). Авторитетная проверка
 * сессии (см. также оптимистичную в `proxy.ts`) — здесь и только здесь;
 * дочерние страницы получают уже гарантированно вошедшего пользователя.
 * Ролевые проверки (например, `/admin` — только `role === 'admin'`) — это
 * следующий, более узкий рубеж внутри конкретной страницы, не здесь.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getSessionUser();

  if (!currentUser) {
    // Не `redirect('/auth')` напрямую: cookie может присутствовать, но быть
    // недействительной на backend — см. комментарий в `src/proxy.ts` про
    // `/auth/clear` и почему без очистки cookie здесь возможен redirect loop.
    redirect('/auth/clear');
  }

  return <CurrentUserProvider initialUser={currentUser}>{children}</CurrentUserProvider>;
}
