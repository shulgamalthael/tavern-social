import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import { GeminiRpdExceededError, GeminiRpmQueueTimeoutError } from './gemini-quota.errors';
import {
  geminiRpdBucketKey,
  geminiRpmBucketKey,
  msUntilNextGeminiRpdReset,
  msUntilNextGeminiRpmBucket,
  sleep,
} from './gemini-quota.lib';

const RPM_KEY_PREFIX = 'gemini:rpm:';
const RPD_KEY_PREFIX = 'gemini:rpd:';
const STATS_KEY_PREFIX = 'gemini:stats:';
/** Небольшой запас поверх фактических 60 секунд окна — TTL ключа не обязан
 * быть микроскопически точным, только не даёт ключу пережить своё окно
 * надолго (см. `RPD_KEY_TTL_BUFFER_SECONDS` — тот же приём для дневного окна). */
const RPM_KEY_TTL_SECONDS = 65;
const RPD_KEY_TTL_BUFFER_SECONDS = 300;
const STAT_NAMES = [
  'total',
  'success',
  'failed',
  '429',
  'queued',
  'rpm_queue_timeout',
  'rpd_blocked',
] as const;

type QuotaOutcome = 'success' | 'failed' | '429';

export interface GeminiQuotaSnapshot {
  rpm: { used: number; safetyLimit: number; officialLimit: number };
  rpd: { used: number; safetyLimit: number; officialLimit: number; resetAt: Date };
  stats: Record<(typeof STAT_NAMES)[number], number>;
}

/** `INCR` + условный откат `DECR` в ОДНОМ Lua-скрипте — Redis выполняет
 * скрипты атомарно (однопоточно, ничей другой `EVAL`/команда не может
 * вклиниться между `INCR` и условным `DECR`), в отличие от тех же двух
 * команд, выпущенных отдельно с проверкой между ними на стороне клиента
 * (был реальный race: параллельный запрос мог увидеть завышенный счётчик в
 * узком окне между `INCR` и откатным `DECR` и получить отказ, хотя реальное
 * использование было в пределах лимита). Возвращает `1`, если слот
 * зарезервирован, `0` — если лимит уже был бы превышен (и счётчик уже
 * откачен обратно скриптом, вызывающему ничего откатывать не нужно). */
const RESERVE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;

/**
 * Единая, глобальная (across все инстансы backend за одним Redis, не
 * per-user/per-process — GEMINI OPTIMIZATION §6) точка контроля RPM/RPD
 * квоты Gemini. `GeminiAdapter` — единственный вызывающий (единственное
 * место в проекте, которое реально делает fetch к Gemini, см. её
 * комментарий) — обязан зарезервировать слот здесь ПЕРЕД каждой отправкой,
 * включая повторные попытки одного и того же хода (§26: ретрай — это тоже
 * новый запрос и тоже обязан учитываться в бюджете).
 *
 * RPD резервируется РОВНО ОДИН раз за вызов `waitForSlot` (не на каждой
 * попытке опроса RPM ниже) — реальное потребление дневного бюджета известно
 * сразу (проверить RPD можно один раз: пока мы ждём свободный RPM-слот,
 * дневной бюджет может только уменьшаться, а не освобождаться, так что
 * пере-проверять его на каждой итерации бессмысленно и лишь плодит лишние
 * round-trip'ы в Redis). Если в итоге не удалось дождаться RPM-слота,
 * зарезервированный RPD-бюджет освобождается один раз в `catch` ниже.
 */
@Injectable()
export class GeminiQuotaService {
  private readonly logger = new Logger(GeminiQuotaService.name);

  private readonly rpmLimit: number;
  private readonly rpmSafetyLimit: number;
  private readonly rpdLimit: number;
  private readonly rpdSafetyLimit: number;
  private readonly queueMaxWaitMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.rpmLimit = config.geminiRpmLimit;
    this.rpmSafetyLimit = config.geminiRpmSafetyLimit;
    this.rpdLimit = config.geminiRpdLimit;
    this.rpdSafetyLimit = config.geminiRpdSafetyLimit;
    this.queueMaxWaitMs = config.geminiQueueMaxWaitMs;

    // Не падаем при странной конфигурации (см. `GEMINI_API_KEY` в
    // `GeminiAdapter` — тот же принцип "предупредить, не свалить старт") —
    // но оператор ДОЛЖЕН узнать, что safety-лимит выше официального лимита
    // плана значит "safety-лимита фактически нет".
    if (this.rpmSafetyLimit > this.rpmLimit) {
      this.logger.warn(
        `GEMINI_RPM_SAFETY_LIMIT (${this.rpmSafetyLimit}) выше GEMINI_RPM_LIMIT (${this.rpmLimit}) — safety-запас отсутствует`,
      );
    }
    if (this.rpdSafetyLimit > this.rpdLimit) {
      this.logger.warn(
        `GEMINI_RPD_SAFETY_LIMIT (${this.rpdSafetyLimit}) выше GEMINI_RPD_LIMIT (${this.rpdLimit}) — safety-запас отсутствует`,
      );
    }
  }

  /**
   * Блокирует вызывающего, пока не удастся зарезервировать слот в ОБОИХ
   * бюджетах — или бросает понятную ошибку, если это невозможно. RPD не
   * имеет смысла ждать внутри одного HTTP/SSE-запроса (сброс — раз в сутки,
   * см. `GeminiRpdExceededError`) — блокируется сразу. RPM ждём в пределах
   * `queueMaxWaitMs` (окно короткое, до минуты) с повторными попытками —
   * вызывающий это реальный пользователь, ждущий ответа в этом же запросе.
   */
  async waitForSlot(operation: string): Promise<void> {
    const startedAt = Date.now();

    const rpdNow = new Date();
    const rpdKey = `${RPD_KEY_PREFIX}${geminiRpdBucketKey(rpdNow)}`;
    const rpdTtlSeconds =
      Math.ceil(msUntilNextGeminiRpdReset(rpdNow) / 1000) + RPD_KEY_TTL_BUFFER_SECONDS;
    const rpdGranted = await this.reserve(rpdKey, this.rpdSafetyLimit, rpdTtlSeconds);
    if (!rpdGranted) {
      await this.bumpStat('rpd_blocked');
      throw new GeminiRpdExceededError(
        new Date(rpdNow.getTime() + msUntilNextGeminiRpdReset(rpdNow)),
      );
    }

    try {
      for (;;) {
        const now = new Date();
        const rpmKey = `${RPM_KEY_PREFIX}${geminiRpmBucketKey(now)}`;
        const rpmGranted = await this.reserve(rpmKey, this.rpmSafetyLimit, RPM_KEY_TTL_SECONDS);
        if (rpmGranted) return;

        const remainingBudgetMs = this.queueMaxWaitMs - (Date.now() - startedAt);
        if (remainingBudgetMs <= 0) {
          await this.bumpStat('rpm_queue_timeout');
          throw new GeminiRpmQueueTimeoutError();
        }

        await this.bumpStat('queued');
        const waitMs = Math.max(0, Math.min(msUntilNextGeminiRpmBucket(now), remainingBudgetMs));
        this.logger.debug(
          `[${operation}] RPM safety-лимит достигнут, ждём ${waitMs}мс перед повтором`,
        );
        await sleep(waitMs);
      }
    } catch (error) {
      // RPM-слот так и не освободился за отведённое время — не отправляем
      // запрос вовсе, значит и зарезервированный дневной бюджет нужно
      // вернуть, иначе он "сгорал" бы впустую.
      await this.redis.decr(rpdKey);
      throw error;
    }
  }

  /** Записывает исход одной реальной попытки запроса к Gemini (успех, отказ
   * не-429, или сам 429) в счётчики телеметрии (§4-5, §37). Намеренно НЕ
   * читает `getSnapshot()` здесь — это добавило бы 3 лишних Redis round-trip'а
   * (2×`GET` + `MGET` из 7 ключей) на КАЖДЫЙ запрос к Gemini исключительно
   * ради строки лога; текущее состояние бюджета при необходимости
   * запрашивается отдельно через публичный `getSnapshot()`. */
  async recordOutcome(operation: string, outcome: QuotaOutcome): Promise<void> {
    await this.bumpStat('total');
    await this.bumpStat(outcome);
    this.logger.debug(`[${operation}] Gemini ${outcome}`);
  }

  async getSnapshot(): Promise<GeminiQuotaSnapshot> {
    const now = new Date();
    const rpmKey = `${RPM_KEY_PREFIX}${geminiRpmBucketKey(now)}`;
    const rpdKey = `${RPD_KEY_PREFIX}${geminiRpdBucketKey(now)}`;

    const [rpmUsedRaw, rpdUsedRaw, stats] = await Promise.all([
      this.redis.get(rpmKey),
      this.redis.get(rpdKey),
      this.getAllStats(),
    ]);

    return {
      rpm: {
        used: Number(rpmUsedRaw ?? 0),
        safetyLimit: this.rpmSafetyLimit,
        officialLimit: this.rpmLimit,
      },
      rpd: {
        used: Number(rpdUsedRaw ?? 0),
        safetyLimit: this.rpdSafetyLimit,
        officialLimit: this.rpdLimit,
        resetAt: new Date(now.getTime() + msUntilNextGeminiRpdReset(now)),
      },
      stats,
    };
  }

  /** Атомарно инкрементирует `key` и откатывает инкремент обратно, если
   * результат превысил `safetyLimit` — см. `RESERVE_SCRIPT`'s комментарий про
   * то, почему это Lua-скрипт, а не `INCR`+проверка+`DECR` тремя отдельными
   * командами. */
  private async reserve(key: string, safetyLimit: number, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.eval(RESERVE_SCRIPT, 1, key, safetyLimit, ttlSeconds);
    return Number(result) === 1;
  }

  private async bumpStat(name: string): Promise<void> {
    try {
      await this.redis.incr(`${STATS_KEY_PREFIX}${name}`);
    } catch (error) {
      // Телеметрия не должна ронять реальный запрос — только предупреждаем.
      this.logger.warn(
        `Не удалось обновить счётчик ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async getAllStats(): Promise<GeminiQuotaSnapshot['stats']> {
    const keys = STAT_NAMES.map((name) => `${STATS_KEY_PREFIX}${name}`);
    const values = await this.redis.mget(keys);
    return Object.fromEntries(
      STAT_NAMES.map((name, index) => [name, Number(values[index] ?? 0)]),
    ) as GeminiQuotaSnapshot['stats'];
  }
}
