import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestOrigin } from '@/shared/lib/request-origin';

/** Тот же `BACKEND_URL`, что и `shared/lib/backend-client.ts`/`proxy.ts` —
 * не импортирует их напрямую по тем же причинам, что описаны в `proxy.ts`
 * (`server-only`/лишняя связь). Route Handler, а не прямая ссылка из
 * `AuthForm.tsx` на backend: браузер не должен знать адрес backend вообще
 * (см. AGENTS.md §5) — этот тонкий редирект держит единственный переход на
 * чужой origin внутри Next.js, а не в клиентской разметке. */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

/** Начало Google-входа — 302 на backend, тот сам редиректит дальше на
 * Google (см. `AuthController.googleLogin`). Реальная навигация браузера,
 * не Server Action: нужен обычный `<a href="/auth/google">`.
 *
 * `origin` в query string — реальный адрес, с которого пришёл этот запрос
 * (`getRequestOrigin`, см. её комментарий — например
 * `https://<tunnel>.ngrok-free.dev`, если дашборд открыли через туннель, а
 * не с `localhost`) — backend вернёт браузер именно сюда после входа, если
 * этот адрес есть в его `ALLOWED_OAUTH_ORIGINS` (см.
 * `AuthService.resolveOAuthOrigin`), иначе тихо откатится на свой
 * `FRONTEND_URL`, как было раньше. */
export function GET(request: NextRequest): NextResponse {
  const url = new URL(`${BACKEND_URL}/auth/google`);
  url.searchParams.set('origin', getRequestOrigin(request));
  return NextResponse.redirect(url);
}
