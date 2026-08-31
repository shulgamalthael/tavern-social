import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import { sleep } from '../quota/gemini-quota.lib';
import type { LlmChatResult } from '../llm-provider';

const RESULT_KEY_PREFIX = 'ai:dedup:result:';
const LOCK_KEY_PREFIX = 'ai:dedup:lock:';
/** Потолок на то, сколько живёт in-flight-лок, даже если процесс, который его
 * поставил, упал до `releaseInFlightLock` — иначе застрявший лок навсегда
 * блокировал бы дедупликацию по этому отпечатку. Не связан с
 * `aiDedupCacheTtlMs` (TTL самого закэшированного РЕЗУЛЬТАТА) — лок нужен
 * только на время реального обращения к Gemini, которое всегда короче. */
const IN_FLIGHT_LOCK_TTL_MS = 30_000;
const POLL_INTERVAL_MS = 200;

/**
 * Combined DEDUPLICATION + CACHE слой Request Manager (AI CAPACITY & COST
 * MANAGER §3, §21) — реализованы одним механизмом, не двумя: у чат-продукта
 * нет естественного "cache key" для произвольных ответов модели (текст
 * пользователя почти никогда не повторяется буквально), поэтому "кэш" здесь
 * это буквально "результат недавнего ИДЕНТИЧНОГО отпечатка" — то же самое,
 * что защищает от дублей. Честно упрощённый скоуп относительно полного
 * spec'а (нет отдельного semantic/content-addressed кэша) — задокументировано
 * в финальном отчёте, не скрыто.
 *
 * Redis, не in-memory — см. `AiCapacitySnapshot`'s комментарий в схеме про
 * multi-instance: дедупликация обязана работать через несколько инстансов
 * backend за одним Redis, не только внутри одного процесса.
 */
@Injectable()
export class AiDedupCacheService {
  private readonly logger = new Logger(AiDedupCacheService.name);
  private readonly ttlMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    this.ttlMs = configService.get<AppConfig>('app')!.aiDedupCacheTtlMs;
  }

  async getCachedResult(fingerprint: string): Promise<LlmChatResult | null> {
    if (this.ttlMs <= 0) return null;
    const raw = await this.redis.get(`${RESULT_KEY_PREFIX}${fingerprint}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LlmChatResult;
    } catch {
      return null;
    }
  }

  async storeResult(fingerprint: string, result: LlmChatResult): Promise<void> {
    if (this.ttlMs <= 0) return;
    await this.redis.set(
      `${RESULT_KEY_PREFIX}${fingerprint}`,
      JSON.stringify(result),
      'PX',
      this.ttlMs,
    );
  }

  /** Атомарный `SET NX` — первый вызывающий с данным отпечатком получает
   * `true` и обязан реально сходить к Gemini; любой параллельный вызывающий с
   * ТЕМ ЖЕ отпечатком получает `false` и должен звать `waitForInFlightResult`
   * вместо повторного обращения к провайдеру. */
  async tryAcquireInFlightLock(fingerprint: string): Promise<boolean> {
    const result = await this.redis.set(
      `${LOCK_KEY_PREFIX}${fingerprint}`,
      '1',
      'PX',
      IN_FLIGHT_LOCK_TTL_MS,
      'NX',
    );
    return result === 'OK';
  }

  async releaseInFlightLock(fingerprint: string): Promise<void> {
    await this.redis.del(`${LOCK_KEY_PREFIX}${fingerprint}`);
  }

  /** Опрос `getCachedResult` до появления результата или `maxWaitMs` — тот же
   * bounded-poll приём, что `GeminiQuotaService.waitForSlot` в прошлой
   * итерации. `null` при таймауте — вызывающий (`AiGatewayService`) тогда
   * идёт своим путём как обычный (недедуплицированный) запрос, а НЕ ждёт
   * бесконечно застрявший лок. */
  async waitForInFlightResult(
    fingerprint: string,
    maxWaitMs: number,
  ): Promise<LlmChatResult | null> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      const cached = await this.getCachedResult(fingerprint);
      if (cached) return cached;
      await sleep(POLL_INTERVAL_MS);
    }
    this.logger.warn(
      `Истёк таймаут ожидания in-flight результата для отпечатка ${fingerprint.slice(0, 12)}…`,
    );
    return null;
  }
}
