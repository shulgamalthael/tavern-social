import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Тот же `BACKEND_URL`, что и `shared/lib/backend-client.ts`/`proxy.ts` —
 * не импортирует их напрямую по тем же причинам, что описаны в `proxy.ts`
 * (`server-only`/лишняя связь). Route Handler, а не прямая ссылка из
 * `AuthForm.tsx` на backend: браузер не должен знать адрес backend вообще
 * (см. AGENTS.md §5) — этот тонкий редирект держит единственный переход на
 * чужой origin внутри Next.js, а не в клиентской разметке. */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

/** Список синхронизирован вручную с backend'ым `OAuthProviderRegistry`
 * (`REGISTERED_PROVIDERS`) — здесь только чтобы не проксировать браузер на
 * ЛЮБОЙ `/auth/<что угодно>` (напр. `/auth/clear`, у которого уже есть свой
 * собственный маршрут), а не как источник истины: реальную проверку
 * «настроен ли этот провайдер» всё равно делает backend'ый
 * `OAuthConfiguredGuard`. */
const KNOWN_PROVIDERS = new Set(['google', 'facebook']);

/** Начало OAuth-входа — 302 на backend, тот сам редиректит дальше на
 * провайдера (см. `AuthController.oauthLogin`). Реальная навигация
 * браузера, не Server Action: нужен обычный `<a href="/auth/google">` /
 * `<a href="/auth/facebook">`. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/auth/[provider]'>,
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  if (!KNOWN_PROVIDERS.has(provider)) {
    return new NextResponse('Неизвестный провайдер входа', { status: 404 });
  }
  return NextResponse.redirect(`${BACKEND_URL}/auth/${provider}`);
}
