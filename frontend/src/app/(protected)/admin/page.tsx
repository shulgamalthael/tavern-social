import { redirect } from 'next/navigation';
// eslint-disable-next-line no-restricted-imports
import { getSessionUser } from '@/features/auth/api/session.server';
import { AdminWidget } from '@/widgets/admin';

/**
 * Отдельный маршрут, не раздел SPA (см. `widgets/navigation-dock` — ссылка
 * сюда обычная, не `goToSection`) — именно поэтому у него собственный,
 * более узкий рубеж поверх общей сессионной проверки из
 * `(protected)/layout.tsx`: тот гарантирует только «пользователь вошёл»,
 * не «пользователь администратор». Не-админ, зашедший по прямой ссылке,
 * молча уходит на `/`, а не видит страницу с ошибкой доступа — раздела для
 * него как будто не существует, то же поведение, что и у скрытого пункта
 * навигации.
 *
 * `getSessionUser()` вызывается второй раз (уже был в layout) — не лишний
 * запрос: DAL обёрнут в React `cache()`, второй вызов в рамках того же
 * рендера отдаёт запомненный результат без похода к backend.
 */
export default async function AdminPage() {
  const currentUser = await getSessionUser();

  if (currentUser?.role !== 'admin') {
    redirect('/');
  }

  return <AdminWidget />;
}
