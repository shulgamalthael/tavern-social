import { lookup } from 'node:dns/promises';

export interface LinkMetadata {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

const FETCH_TIMEOUT_MS = 3000;
const MAX_RESPONSE_BYTES = 512 * 1024;
/** Больше ссылок в одном посте не резолвим превью — не блокировать
 * публикацию долгим последовательным/параллельным фетчингом произвольного
 * числа внешних адресов. */
const MAX_LINKS_PER_POST = 3;

const HREF_PATTERN = /href="(https?:\/\/[^"]+)"/g;

/** Ссылки в порядке появления в контенте, без дублей, не больше
 * `MAX_LINKS_PER_POST` — санитизированный HTML уже гарантирует, что `href`
 * это валидный http(s)-адрес (см. sanitize-post-content.ts). */
export function extractLinks(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(HREF_PATTERN)) {
    if (urls.size >= MAX_LINKS_PER_POST) break;
    urls.add(match[1]);
  }
  return [...urls];
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') || // fc00::/7 (unique local)
    normalized.startsWith('fe80') // link-local
  );
}

/** SSRF-защита: резолвит хост и отклоняет приватные/loopback/link-local
 * адреса до отправки запроса. Не защищает от DNS rebinding (IP может
 * измениться между этой проверкой и реальным `fetch`) — осознанный
 * компромисс, см. план/отчёт по задаче. */
async function assertPublicHost(hostname: string): Promise<void> {
  const { address, family } = await lookup(hostname);
  const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
  if (isPrivate) throw new Error('Адрес ссылки указывает на внутреннюю сеть');
}

/** `Response.body` без `"dom"` в `tsconfig.lib` типизируется слишком слабо
 * для стандартного `getReader()`-протокола (Node/undici поддерживает его в
 * рантайме, но не типы без lib.dom) — читаем через async-итератор, который
 * Node гарантирует рантайм-но, с явным приведением типа один раз здесь. */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';

  const body = response.body as unknown as AsyncIterable<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let received = 0;
  for await (const chunk of body) {
    received += chunk.byteLength;
    chunks.push(chunk);
    if (received >= maxBytes) break;
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function parseMetaTags(html: string): Omit<LinkMetadata, 'domain'> {
  const titleTag = html.match(/<title>([^<]*)<\/title>/i);
  return {
    title: metaContent(html, 'og:title') ?? (titleTag ? titleTag[1].trim() : null),
    description: metaContent(html, 'og:description') ?? metaContent(html, 'description'),
    imageUrl: metaContent(html, 'og:image'),
  };
}

/**
 * Получает title/description/preview-картинку внешней страницы — таймаут,
 * лимит размера ответа, только `text/html`, только `http(s)` на публичный
 * адрес. Разбор — регуляркой по meta-тегам, не полноценным HTML-парсером
 * (`cheerio`/`jsdom`) — простого regex-извлечения OG-тегов достаточно и не
 * тянет тяжёлую зависимость. Любая ошибка на любом шаге → `null` — ссылка
 * в посте продолжает работать как обычная, публикация не блокируется.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  try {
    await assertPublicHost(parsed.hostname);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    const html = await readLimited(response, MAX_RESPONSE_BYTES);
    return { ...parseMetaTags(html), domain: parsed.hostname };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
