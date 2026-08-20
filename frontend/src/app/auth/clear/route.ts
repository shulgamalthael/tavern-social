import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/shared/config/session';

/**
 * Чистит недействительную cookie сессии и редиректит на `/auth`. Нужен как
 * отдельный Route Handler, а не прямой `redirect('/auth')` из `page.tsx`:
 * Server Component не может писать cookies, а без очистки `proxy.ts` увидел
 * бы ту же (просроченную) cookie на `/auth` и редиректил обратно на `/`,
 * зациклив `/ → /auth → / → …` (см. комментарий в `proxy.ts`).
 */
export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/auth', request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
