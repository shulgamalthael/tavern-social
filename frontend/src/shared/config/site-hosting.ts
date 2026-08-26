import { normalizeHostname } from '@/shared/lib/hostname';

/**
 * Хост самого приложения (дашборд/билдер/аутентификация) — всё, что не
 * совпадает с ним, `proxy.ts` считает запросом к опубликованному сайту
 * бизнеса и резолвит через backend (`GET /sites/resolve`, см. корневой план
 * задачи «multi-tenant domains» — разделение `app.myapp.com` и
 * `{slug}.myapp.com`/customer-доменов на разные хосты). В проде задаётся
 * явно; локальный дефолт — `localhost:3000` (обычный порт `next dev`).
 */
export const APP_HOSTNAME = process.env.APP_HOSTNAME ?? 'localhost:3000';

/** Тот же базовый домен системных сабдоменов, что и у backend
 * (`SITES_BASE_DOMAIN` в `backend/.env`) — используется только для одного
 * dev-фолбэка ниже, не для сборки самих системных хостов (те собирает
 * исключительно backend, см. `DomainsService`). */
const SITES_BASE_DOMAIN = process.env.SITES_BASE_DOMAIN ?? 'localhost';

/** Те же три паттерна, что и `allowedDevOrigins` в `next.config.ts` —
 * бесплатный ngrok-туннель на каждый перезапуск получает новый случайный
 * поддомен, поэтому его нельзя один раз прописать в `APP_HOSTNAME`. Без
 * этого списка сам дашборд, открытый через туннель (`*.ngrok-free.dev` и
 * т. п.), выглядел бы для `proxy.ts` как визит на неизвестный сайт бизнеса
 * и упирался бы в «Сайт не найден» (см. `resolveSiteHostname`) — ровно
 * так и произошло один раз, отсюда и этот список. Актуально только для
 * dev/демонстраций через туннель — в проде такие хосты никогда не приходят,
 * раз ngrok там не запущен. */
const DEV_TUNNEL_HOST_PATTERNS = [/\.ngrok-free\.dev$/, /\.ngrok-free\.app$/, /\.ngrok\.io$/];

/**
 * `true`, если запрос пришёл на хост самого приложения, а не на сайт
 * бизнеса. Порт `next dev` в деле может отличаться от дефолтного (см.
 * комментарий `APP_HOSTNAME` — например, при занятом 3000 Next сам
 * перескакивает на 3001), поэтому для локальной разработки голый
 * `localhost` (без поддомена) всегда считается приложением независимо от
 * порта — иначе рассинхрон `APP_HOSTNAME` с фактическим портом ломал бы
 * весь дашборд, принимая его за неизвестный сайт бизнеса.
 */
export function isAppHostname(rawHost: string): boolean {
  const host = normalizeHostname(rawHost);
  if (host === normalizeHostname(APP_HOSTNAME)) return true;
  if (SITES_BASE_DOMAIN === 'localhost' && host === 'localhost') return true;
  return DEV_TUNNEL_HOST_PATTERNS.some((pattern) => pattern.test(host));
}
