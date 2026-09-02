import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/shared/config/session';
import { getRequestOrigin } from '@/shared/lib/request-origin';

/**
 * Чистит недействительную cookie сессии и редиректит на `/auth`. Нужен как
 * отдельный Route Handler, а не прямой `redirect('/auth')` из `page.tsx`:
 * Server Component не может писать cookies, а без очистки `proxy.ts` увидел
 * бы ту же (просроченную) cookie на `/auth` и редиректил обратно на `/`,
 * зациклив `/ → /auth → / → …` (см. комментарий в `proxy.ts`).
 *
 * Редирект строится через `getRequestOrigin` (`shared/lib/request-origin.ts`),
 * не через `new URL('...', request.url)` — та же правка, что и в
 * `app/auth/google/route.ts`/`app/auth/callback/route.ts`: `request.url`
 * отражает адрес, на котором слушает сам Next.js, а не реальный `Host`
 * запроса, так что при доступе через ngrok-туннель/LAN-адрес этот редирект
 * тоже молча уводил на `localhost`.
 */
export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/auth', getRequestOrigin(request)));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
