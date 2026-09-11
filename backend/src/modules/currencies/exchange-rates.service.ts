import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import { getCurrencyMetadata } from './currencies';

/** Бесплатный, без ключа API поверх ежедневных референсных курсов ЕЦБ
 * (обновляются ~16:00 CET) — https://frankfurter.dev. Не биржевой курс в
 * реальном времени: для задачи "привести ставки рекламодателей в разных
 * валютах к одному числу для ранжирования" точности "раз в день" более
 * чем достаточно, реальные деньги этим курсом нигде не списываются (см.
 * `AdCampaignsService.getPlacementInsights` — единственный вызывающий).
 * ЕЦБ публикует курсы не для всех валют проекта — в частности, `UAH`
 * (`DEFAULT_BUSINESS_CURRENCY`) там нет; для таких валют `convertToUsdCents`
 * честно возвращает `null`, а не бросает и не подставляет случайное число. */
const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';
/** Меньше суток — оставляет запас до следующей публикации ЕЦБ (~16:00 CET),
 * а не гонится ровно за 24-часовой границей. */
const CACHE_TTL_SECONDS = 20 * 60 * 60;
const CACHE_KEY = 'fx:rates:usd-base';
const FETCH_TIMEOUT_MS = 5000;

interface FrankfurterResponse {
  rates: Record<string, number>;
}

/** Курсы — `X per 1 USD` (то же направление, что отдаёт Frankfurter с
 * `base=USD`), не наоборот. */
export type RatesToUsd = Record<string, number>;

/** Чистая часть конвертации, вынесенная из `convertToUsdCents`, чтобы
 * вызывающий, которому нужно привести МНОГО сумм подряд (например,
 * `AdCampaignsService.getPlacementInsights` — по одной на каждую активную
 * кампанию), мог один раз получить `rates` через `getRatesToUsd` и дальше
 * звать эту синхронную функцию в цикле, не делая по Redis-запросу на
 * каждую сумму. См. `convertToUsdCents`'s комментарий про майорные единицы
 * — та же логика, один источник истины. */
export function convertUsingRates(
  amountMinorUnits: number,
  fromCurrency: string,
  rates: RatesToUsd | null,
): number | null {
  if (fromCurrency === 'USD') return amountMinorUnits;

  const rate = rates?.[fromCurrency];
  if (!rate) return null;

  const fromMajorAmount = amountMinorUnits / 10 ** getCurrencyMetadata(fromCurrency).minorUnit;
  const usdMajorAmount = fromMajorAmount / rate;
  return Math.round(usdMajorAmount * 100);
}

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * `amountMinorUnits` — сумма в минимальных единицах `fromCurrency` (тот
   * же смысл, что `priceCents`/`bidCents` по всему проекту). Возвращает
   * сумму в минимальных единицах USD (т. е. в обычных центах) или `null`,
   * если курс недоступен (внешний сервис не ответил, либо ЕЦБ не публикует
   * курс для этой валюты) — вызывающий обязан явно обработать `null`, а не
   * получить тихо неверное число.
   *
   * Для ОДНОЙ суммы за раз. Приводя МНОГО сумм подряд, вызовите
   * `getRatesToUsd()` один раз и используйте `convertUsingRates` в цикле —
   * иначе каждый вызов этого метода заново обращается к Redis-кэшу курсов.
   */
  async convertToUsdCents(amountMinorUnits: number, fromCurrency: string): Promise<number | null> {
    if (fromCurrency === 'USD') return amountMinorUnits;

    const rates = await this.getRatesToUsd();
    return convertUsingRates(amountMinorUnits, fromCurrency, rates);
  }

  async getRatesToUsd(): Promise<RatesToUsd | null> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as RatesToUsd;

    const fetched = await this.fetchRates();
    if (!fetched) return null;

    await this.redis.set(CACHE_KEY, JSON.stringify(fetched), 'EX', CACHE_TTL_SECONDS);
    return fetched;
  }

  /** Не бросает — сетевой сбой/недоступность Frankfurter не должна ронять
   * вызывающего (`getPlacementInsights` и так работоспособна без денежной
   * метрики, см. её комментарий), только логируется. */
  private async fetchRates(): Promise<RatesToUsd | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(FRANKFURTER_URL, { signal: controller.signal });
      if (!response.ok) {
        this.logger.warn(`Frankfurter ответил ${response.status}`);
        return null;
      }
      const data = (await response.json()) as FrankfurterResponse;
      return data.rates;
    } catch (error) {
      this.logger.warn(
        `Не удалось получить курсы валют: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
