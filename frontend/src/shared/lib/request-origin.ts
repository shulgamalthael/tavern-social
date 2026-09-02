import type { NextRequest } from 'next/server';

/**
 * Реальный origin входящего запроса — из `Host`/`X-Forwarded-Proto`
 * заголовков, НЕ из `request.nextUrl.origin`/`request.url`. Обе последние
 * отражают адрес, на котором в буквальном смысле слушает сам Next.js
 * (например, `http://localhost:3000`), а не то, что реально стоит в адресной
 * строке браузера — за обратным прокси (ngrok-туннель, LAN-адрес с другим
 * `Host`, будущий прод-домен) они молча расходятся, и построенный на них
 * редирект уводит куда угодно, только не туда, откуда пришёл запрос
 * (проверено вживую curl'ом с подделанным `Host: <ngrok-туннель>` —
 * `nextUrl.origin` всё равно возвращал `localhost:3000`).
 *
 * Тот же принцип, что уже применялся в `proxy.ts` для определения хоста
 * (`request.headers.get('host')`, не `nextUrl`) — здесь тот же приём вынесен
 * в общую функцию, так как одна и та же логика понадобилась в трёх разных
 * Route Handler'ах (`app/auth/google`, `app/auth/callback`, `app/auth/clear`).
 *
 * `x-forwarded-proto` — обратный прокси перед Next.js его выставляет; без
 * прокси заголовка просто нет, тогда берём протокол из `nextUrl` (сам
 * процесс Next.js всегда знает, HTTP он или HTTPS с реальным
 * TLS-терминированием на себе).
 */
export function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get('host');
  if (!host) return request.nextUrl.origin;

  const protocol =
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return `${protocol}://${host}`;
}
