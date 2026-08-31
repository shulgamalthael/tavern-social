/**
 * Чистые (без побочных эффектов) вычисления, на которых стоит
 * `GeminiQuotaService` — вынесены отдельно от самого сервиса именно чтобы их
 * можно было протестировать без реального/поднятого Redis (см.
 * `gemini-quota.lib.test.ts`), тем же приёмом, что `tools/lib/block-tree.ts`
 * отделён от `ToolRegistryService`.
 */

/** Gemini (Google AI) сбрасывает дневную квоту по тихоокеанскому времени, не
 * по UTC и не по локальному времени пользователя/сервера — см. GEMINI
 * OPTIMIZATION §9 "не создавать собственную временную зону, противоречащую
 * фактической квоте". `Intl.DateTimeFormat` с `timeZone` ниже — без стороннего
 * пакета для работы с часовыми поясами (`date-fns-tz` и т. п. в проекте нет,
 * заводить зависимость ради одной конвертации избыточно). */
const GEMINI_QUOTA_TIME_ZONE = 'America/Los_Angeles';

const rpdDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: GEMINI_QUOTA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const rpdClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GEMINI_QUOTA_TIME_ZONE,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Ключ "дневного бакета" RPD-счётчика — `YYYY-MM-DD` в тихоокеанском
 * времени (локаль `en-CA` у `Intl.DateTimeFormat` формирует именно такой
 * порядок частей без ручной сборки строки). */
export function geminiRpdBucketKey(now: Date): string {
  return rpdDateFormatter.format(now);
}

/** Сколько миллисекунд осталось до полуночи по тихоокеанскому времени — ставим
 * TTL на Redis-ключ RPD-бюджета и оценку `resetAt` для ошибки
 * `GeminiRpdExceededError`. */
export function msUntilNextGeminiRpdReset(now: Date): number {
  const parts = rpdClockFormatter.formatToParts(now);
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);

  // `% 24` — защита от квирка ICU, где `hour12: false` на некоторых рантаймах
  // отдаёт "24" для полуночи вместо "00" (наблюдалось не везде, но дёшево
  // подстраховаться, не полагаясь на конкретную версию Node/ICU).
  const hour = part('hour') % 24;
  const msIntoDay =
    (hour * 3600 + part('minute') * 60 + part('second')) * 1000 + now.getMilliseconds();

  return 24 * 60 * 60 * 1000 - msIntoDay;
}

const RPM_WINDOW_MS = 60_000;

/** Ключ "минутного бакета" RPM-счётчика — фиксированное окно по UTC-эпохе
 * (не тихоокеанское время: RPM — скользящий/фиксированный интервал в 60
 * секунд, часовой пояс здесь ни при чём, в отличие от RPD). */
export function geminiRpmBucketKey(now: Date): string {
  return String(Math.floor(now.getTime() / RPM_WINDOW_MS));
}

/** Сколько миллисекунд осталось до смены текущего RPM-бакета — оценка
 * "сколько ждать", когда текущая минута исчерпала свой safety-лимит. */
export function msUntilNextGeminiRpmBucket(now: Date): number {
  return RPM_WINDOW_MS - (now.getTime() % RPM_WINDOW_MS);
}

/** Экспоненциальный backoff с джиттером для повторных попыток после 429 (см.
 * GEMINI OPTIMIZATION §26) — джиттер нужен, чтобы несколько запросов,
 * упёршихся в лимит одновременно, не били по Gemini синхронной пачкой на
 * каждом retry. */
export function computeGeminiBackoffDelayMs(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * 2 ** (attempt - 1);
  const jitter = Math.random() * baseDelayMs;
  return Math.round(exponential + jitter);
}

/** Парсит заголовок `Retry-After` Gemini-ответа (секунды ИЛИ HTTP-дата, см.
 * RFC 9110 §10.2.3) — `null`, если заголовка нет или он не распознан
 * (вызывающий код тогда сам считает backoff через
 * `computeGeminiBackoffDelayMs`). */
export function parseGeminiRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
