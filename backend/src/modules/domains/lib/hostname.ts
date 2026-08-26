/** Не даём подключить подстроку под системные сабдомены как «свой» домен —
 * см. `DomainsService.connectCustomDomain` — этот список также защищает
 * системные служебные адреса (`www.`, `api.` и т. п.), если когда-нибудь
 * появится общий домен уровня приложения, а не только `SITES_BASE_DOMAIN`. */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'ftp',
  'smtp',
  'localhost',
  'staging',
  'dashboard',
  'support',
  'help',
  'blog',
  'static',
  'assets',
  'cdn',
  'ns1',
  'ns2',
  'root',
  'test',
  'dev',
]);

export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain);
}

/** Каждый label — 1–63 символа, строчные латинские буквы/цифры/дефис, без
 * дефиса на границах; финальный label (TLD) — минимум 2 латинские буквы.
 * Достаточно строго для реальных доменов, но не пытается быть полноценным
 * RFC 1035-парсером (пунникод/IDN — не в счёт для MVP, см. корневой план
 * задачи: «MVP > overengineering»). */
const HOSTNAME_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,63}$/;

/** Убирает регистр/завершающую точку/порт перед любым сравнением или
 * поиском в БД — без этого `EXAMPLE.COM`, `example.com.` и `example.com`
 * заводили бы дублирующиеся строки `Domain` на один и тот же физический
 * хост (см. корневой план задачи, раздел «Hostname normalization»). Порт
 * специально учтён — браузер кладёt его в заголовок `Host` для любого
 * нестандартного порта (весь локальный dev, `coffee.localhost:3001`),
 * тогда как у реального продакшен-домена порта в hostname нет вовсе. */
export function normalizeHostname(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** Валидация именно пользовательского CUSTOM_DOMAIN — после нормализации,
 * до создания записи (см. `DomainsService.connectCustomDomain`). Системные
 * сабдомены не проходят через эту функцию — их собирает сам backend из уже
 * провalidated `Business.slug`, а не пользовательский ввод. */
export function isValidCustomDomain(hostname: string): boolean {
  if (hostname.length > 253) return false;
  return HOSTNAME_PATTERN.test(hostname);
}

export function buildSystemSubdomain(slug: string, baseDomain: string): string {
  return normalizeHostname(`${slug}.${baseDomain}`);
}
