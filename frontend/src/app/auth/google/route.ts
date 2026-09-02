import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
 * `origin` в query string — реальный адрес, с которого пришёл этот запрос,
 * собран из заголовков, а НЕ из `request.nextUrl.origin`/`.host` — та
 * всегда отдаёт адрес, на котором в буквальном смысле слушает сам Next.js
 * (`localhost:3000`), даже если запрос реально пришёл через ngrok-туннель
 * или с LAN-адреса с другим `Host`-заголовком (проверено вживую: curl с
 * `Host: <туннель>.ngrok-free.dev` всё равно вернул `nextUrl.origin ===
 * 'http://localhost:3000'`). Та же причина, по которой `proxy.ts` читает
 * хост через `request.headers.get('host')`, а не `nextUrl` — см. его
 * комментарий. `x-forwarded-proto` — ngrok и любой другой обратный прокси
 * перед Next.js его выставляет; без туннеля просто нет, тогда берём
 * протокол из `nextUrl` (сам процесс Next.js всегда знает, HTTP он или
 * HTTPS с реальным TLS-терминированием на СЕБЕ). Backend вернёт браузер
 * именно на этот адрес после входа, только если он есть в его
 * `ALLOWED_OAUTH_ORIGINS` (см. `AuthService.resolveOAuthOrigin`), иначе
 * тихо откатится на свой `FRONTEND_URL`, как было раньше. */
export function GET(request: NextRequest): NextResponse {
  const host = request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  const origin = host ? `${protocol}://${host}` : request.nextUrl.origin;

  const url = new URL(`${BACKEND_URL}/auth/google`);
  url.searchParams.set('origin', origin);
  return NextResponse.redirect(url);
}
