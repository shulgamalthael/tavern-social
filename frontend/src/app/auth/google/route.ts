import { NextResponse } from 'next/server';

/** Тот же `BACKEND_URL`, что и `shared/lib/backend-client.ts`/`proxy.ts` —
 * не импортирует их напрямую по тем же причинам, что описаны в `proxy.ts`
 * (`server-only`/лишняя связь). Route Handler, а не прямая ссылка из
 * `AuthForm.tsx` на backend: браузер не должен знать адрес backend вообще
 * (см. AGENTS.md §5) — этот тонкий редирект держит единственный переход на
 * чужой origin внутри Next.js, а не в клиентской разметке. */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

/** Начало Google-входа — 302 на backend, тот сам редиректит дальше на
 * Google (см. `AuthController.googleLogin`). Реальная навигация браузера,
 * не Server Action: нужен обычный `<a href="/auth/google">`. */
export function GET(): NextResponse {
  return NextResponse.redirect(`${BACKEND_URL}/auth/google`);
}
