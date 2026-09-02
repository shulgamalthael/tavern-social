import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/shared/config/session';
import { getRequestOrigin } from '@/shared/lib/request-origin';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

interface AuthSessionResponse {
  token: string;
}

/**
 * Целевая страница OAuth-редиректа с backend (`AuthService.completeGoogleLogin`
 * строит `${origin}/auth/callback?code=...`, `origin` — тот же адрес, с
 * которого реально начали вход, см. `app/auth/google/route.ts`). Route
 * Handler, а не `page.tsx` — `cookies()` из `next/headers` можно мутировать
 * только в Server Action/Route Handler, НЕ в рендере обычного Server
 * Component; вызов cookie-устанавливающего Server Action напрямую из рендера
 * страницы (первая версия этого файла) молча падает с той же ошибкой, что
 * описана в `auth/clear/route.ts`'s комментарии про
 * `response.cookies.delete()` — здесь тот же приём, только `.set()` вместо
 * `.delete()`.
 *
 * Редиректы ниже строятся через `getRequestOrigin` (`shared/lib/request-
 * origin.ts`), НЕ через `new URL('...', request.url)` — см. её комментарий:
 * `request.url` отражает адрес, на котором в буквальном смысле слушает сам
 * Next.js, не заголовок `Host` реального запроса. Раньше эта страница молча
 * возвращала на `localhost:3000` даже при входе через ngrok-туннель или
 * LAN-адрес — тот же баг, что уже был найден и исправлен в соседнем файле,
 * просто не замечен здесь при первом фиксе (проверено вживую — исправлено).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = getRequestOrigin(request);

  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/auth?error=oauth_failed', origin));
  }

  let token: string;
  try {
    const response = await fetch(`${BACKEND_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`exchange failed: ${response.status}`);
    }
    const session = (await response.json()) as AuthSessionResponse;
    token = session.token;
  } catch {
    return NextResponse.redirect(new URL('/auth?error=oauth_failed', origin));
  }

  const redirectResponse = NextResponse.redirect(new URL('/', origin));
  redirectResponse.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return redirectResponse;
}
