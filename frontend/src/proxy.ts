import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAppHostname } from '@/shared/config/site-hosting';
import { SESSION_COOKIE_NAME } from '@/shared/config/session';

const PUBLIC_PATHS = ['/auth', '/site'];
/** Страница входа — при наличии cookie редиректим только отсюда, не из всех /auth/*. */
const AUTH_ENTRY_PATH = '/auth';

/** Тот же `BACKEND_URL`, что и `shared/lib/backend-client.ts` — не импортирует
 * его напрямую: тот модуль помечен `server-only` ради Server Actions/
 * Components, а middleware — отдельная edge-среда выполнения Next.js, из
 * которой `server-only`-пакет тоже технически не запрещён, но лишняя связь
 * не нужна (`backendFetch` тянет за собой `Authorization`/`BackendError`
 * семантику для авторизованных запросов, которая здесь не нужна вовсе —
 * резолвинг хоста в сайт всегда анонимный, см. `PublicSitesController`). */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** hostname → businessId через анонимный `GET /sites/resolve` (см.
 * `PublicSitesController`) — единственное место frontend, которое знает про
 * существование доменов вообще (см. корневой план задачи: «Builder/Renderer
 * НЕ должны знать о домене» — они получают уже готовый `businessId`).
 * `null`, если хост не резолвится вообще (реальная ошибка бэкенда) ИЛИ бэкенд
 * ответил `404` (хост не подключён ни к одному сайту) — оба случая middleware
 * обрабатывает одинаково: не бросает 500 на весь сайт, а показывает
 * «сайт не найден». */
async function resolveSiteHostname(hostname: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/sites/resolve?hostname=${encodeURIComponent(hostname)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { businessId: string };
    return data.businessId;
  } catch {
    return null;
  }
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
 *
 * Перед всем этим — маршрутизация по хосту (см. корневой план задачи,
 * «Host-based routing»): запрос на любой хост, кроме хоста самого
 * приложения (`isAppHostname`), — это визит на опубликованный сайт бизнеса
 * (системный сабдомен `{slug}.SITES_BASE_DOMAIN` или подключённый custom
 * domain), а не на дашборд. Такой запрос никогда не должен упираться в
 * cookie-проверку ниже — у обычного посетителя сайта нет и не может быть
 * аккаунта в Таверне вообще (см. `PublicSitesController`, единственный
 * по-настоящему анонимный контроллер). Рендерится он `NextResponse.rewrite`
 * на `/site/[businessId]/[[...slug]]` — адресная строка браузера остаётся
 * прежней (`coffee.com/about`), это внутренняя переадресация, а не redirect
 * (см. план, «Не перенаправляй его на /business/123»). Исходный `pathname`
 * (`/about`, `/` для главной) переносится в рерайт КАК ЕСТЬ, не отбрасывается
 * — иначе с домена были бы доступны только главные страницы сайтов, а любой
 * путь длиннее одного сегмента 404-ился бы независимо от того, есть ли у
 * сайта такая страница (см. ROADMAP.md §3.2 — без этого multi-page роутинг
 * работал бы только внутри самой Таверны, `/business/[id]/edit`, но не на
 * подключённых доменах, которые как раз и должны быть основным способом
 * посещения сайта).
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host');

  if (host && !isAppHostname(host)) {
    const businessId = await resolveSiteHostname(host);
    if (!businessId) {
      return new NextResponse('Сайт не найден', { status: 404 });
    }
    const url = request.nextUrl.clone();
    url.pathname = `/site/${businessId}${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

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
