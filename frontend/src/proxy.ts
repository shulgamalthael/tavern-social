import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/shared/config/session';

const PUBLIC_PATHS = ['/auth'];
/** Страница входа — при наличии cookie редиректим только отсюда, не из всех /auth/*. */
const AUTH_ENTRY_PATH = '/auth';

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Оптимистичная (edge) проверка сессии: только читает наличие cookie, не
 * обращается к backend — быстрый первый рубеж защиты маршрутов. Авторитетная
 * проверка — на сервере, в `app/page.tsx` через `getSessionUser()` (реально
 * резолвит токен в backend). Именно поэтому cookie может присутствовать, но
 * сессия быть уже недействительной (backend перезапущен, TTL истёк) — на этот
 * случай `page.tsx` редиректит на `/auth/clear`, а не на `/auth` напрямую:
 * если бы cookie-присутствие снова триггерило редирект с `/auth` на `/` здесь,
 * получился бы бесконечный цикл `/ → /auth → / → …`. `/auth/clear` — тоже
 * публичный путь (см. `isPublicPath`), но НЕ совпадает с `AUTH_ENTRY_PATH`,
 * поэтому это правило его не перехватывает.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  if (hasSession && pathname === AUTH_ENTRY_PATH) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // `socket.io` — не страница, а прокси-путь на backend (см. `next.config.ts`,
  // rewrites): своя аутентификация через одноразовый билет, не через
  // сессионную cookie — proxy() не должен вмешиваться и редиректить на /auth.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|socket.io).*)'],
};
