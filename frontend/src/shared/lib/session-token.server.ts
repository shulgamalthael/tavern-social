import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/shared/config/session';

/**
 * Читает сырой токен сессии из httpOnly cookie — используется api-функциями
 * сущностей (все Server Actions в папках `api` под `entities`) для
 * аутентификации запросов к backend. Сам токен непрозрачен для frontend:
 * смысл имеет только для backend (см. `SessionsService` в
 * backend/src/infrastructure/redis).
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
