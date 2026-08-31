import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import {
  LlmProvider,
  type LlmChatResult,
  type LlmMessage,
  type LlmToolSchema,
} from '../llm-provider';
import {
  GeminiRetriesExhaustedError,
  GeminiRpdExceededError,
  GeminiRpmQueueTimeoutError,
} from '../quota/gemini-quota.errors';
import { computeAiRequestFingerprint } from './ai-dedup-cache.lib';
import { AiDedupCacheService } from './ai-dedup-cache.service';
import { AiBudgetService } from './ai-budget.service';
import { AiCapacityService } from './ai-capacity.service';
import { AiRequestAccountingService } from './ai-request-accounting.service';
import { AiCapacityBlockedError, AiBudgetExceededError } from './ai-gateway.errors';
import { getAiOperationDefinition } from './ai-operations.registry';
import type { AiRequestContext } from './ai-capacity.types';

/** Сколько максимум ждать результат ПАРАЛЛЕЛЬНОГО идентичного запроса,
 * прежде чем сдаться и пойти своим путём как обычный (недедуплицированный)
 * запрос — см. `AiDedupCacheService.waitForInFlightResult`'s комментарий про
 * bounded-poll. Меньше `aiDedupCacheTtlMs` (то TTL самого результата, не
 * времени ожидания) — намеренно короткое: если оригинальный запрос завис
 * дольше этого, вероятнее всего он и сам скоро упадёт по своим таймаутам
 * (`GEMINI_QUEUE_MAX_WAIT_MS`), ждать его дольше нет смысла. */
const IN_FLIGHT_WAIT_MS = 15_000;

/**
 * AI Gateway (AI CAPACITY & COST MANAGER §2-3) — ЕДИНСТВЕННАЯ точка входа,
 * которую зовут `AiService`/`AiOnboardingService` вместо прямого обращения к
 * `LlmProvider`. Реализует пайплайн из brief'а в честно упрощённом виде
 * (CREATED → DEDUP/CACHE → CAPACITY → BUDGET → PROVIDER → ACCOUNTING) —
 * COALESCING сознательно не реализован (см. `AiRequestAccountingService`'s
 * файл и финальный отчёт): текущий UI гарантированно не может породить
 * сценарий, для которого coalescing вообще что-то бы значило (форма чата
 * дизейблит поле ввода на время отправки — уже проверено живым тестом в
 * прошлой итерации).
 *
 * `LlmProvider` (`GeminiAdapter`) остаётся ниже этого слоя без изменений
 * своей ответственности — RPM/RPD-квота и retry специфичны для Gemini,
 * capacity/budget здесь — НАША собственная политика поверх ЛЮБОГО
 * провайдера (важно для будущего переключения на OpenAI, о котором
 * договорились: этот файл не знает про Gemini вообще, только про
 * `LlmProvider`-абстракцию).
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly model: string;

  constructor(
    private readonly llmProvider: LlmProvider,
    private readonly dedupCache: AiDedupCacheService,
    private readonly capacity: AiCapacityService,
    private readonly budget: AiBudgetService,
    private readonly accounting: AiRequestAccountingService,
    configService: ConfigService,
  ) {
    this.model = configService.get<AppConfig>('app')!.geminiModel;
  }

  async chat(
    messages: LlmMessage[],
    tools: LlmToolSchema[],
    systemInstruction: string,
    context: AiRequestContext,
  ): Promise<LlmChatResult> {
    const { operation, businessId, actorId } = context;
    const priority = getAiOperationDefinition(operation).priority;
    const fingerprint = computeAiRequestFingerprint(operation, businessId, messages);

    const cached = await this.dedupCache.getCachedResult(fingerprint);
    if (cached) {
      await this.accounting.recordCacheHit(operation);
      return cached;
    }

    let holdsLock = await this.dedupCache.tryAcquireInFlightLock(fingerprint);
    if (!holdsLock) {
      const awaited = await this.dedupCache.waitForInFlightResult(fingerprint, IN_FLIGHT_WAIT_MS);
      if (awaited) {
        await this.accounting.recordDedupHit(operation);
        return awaited;
      }
      // Не дождались — вероятно, оригинальный запрос сам упал/завис. Не
      // блокируем НАВСЕГДА реального пользователя из-за чужого зависшего
      // лока: пробуем перехватить лок ещё раз (мог уже освободиться) и, если
      // получится, идём обычным путём как первый вызывающий.
      this.logger.warn(
        `[${operation}] Не дождались in-flight результата за ${IN_FLIGHT_WAIT_MS}мс — продолжаем как обычный запрос`,
      );
      holdsLock = await this.dedupCache.tryAcquireInFlightLock(fingerprint);
    }

    // ОДИН try/catch на весь путь "capacity → budget → provider" — важно,
    // чтобы отказ капасити/бюджета ТОЖЕ попадал в `AiRequestLog` (через тот
    // же `recordRequest`, что и реальные попытки к Gemini) для наблюдаемости
    // блокировок, а не терялся молча. `latencyMs` в этом случае — время
    // самих проверок, не сетевого вызова, что и ожидаемо для строки со
    // `status: 'rate_limited'`, у которой нет `totalTokens`.
    const startedAt = Date.now();
    try {
      const capacityDecision = await this.capacity.shouldAdmitOperation(priority);
      if (!capacityDecision.admitted) {
        throw new AiCapacityBlockedError(capacityDecision.status);
      }

      const budgetDecision = await this.budget.checkBudgetAdmission(priority, businessId);
      if (!budgetDecision.admitted) {
        throw new AiBudgetExceededError(budgetDecision.exceededScope!);
      }

      const result = await this.llmProvider.chat(messages, tools, systemInstruction, operation);
      const latencyMs = Date.now() - startedAt;

      await this.accounting.recordRequest({
        operation,
        businessId,
        actorId,
        model: this.model,
        status: 'success',
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        totalTokens: result.usage?.totalTokens,
        latencyMs,
      });

      await this.dedupCache.storeResult(fingerprint, result);
      return result;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      await this.accounting.recordRequest({
        operation,
        businessId,
        actorId,
        model: this.model,
        status: this.classifyErrorStatus(error),
        latencyMs,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      if (holdsLock) await this.dedupCache.releaseInFlightLock(fingerprint);
    }
  }

  /** `rate_limited` — сбои, специфичные для квоты (см. `quota/gemini-quota.errors.ts`
   * из прошлой итерации), включая наш собственный capacity/budget-отказ
   * (та же природа: "не сейчас, попробуйте позже", не поломка). Всё
   * остальное (сеть, 5xx, заблокированный промпт) — `failed`. */
  private classifyErrorStatus(error: unknown): 'failed' | 'rate_limited' {
    if (
      error instanceof GeminiRpdExceededError ||
      error instanceof GeminiRpmQueueTimeoutError ||
      error instanceof GeminiRetriesExhaustedError ||
      error instanceof AiCapacityBlockedError ||
      error instanceof AiBudgetExceededError
    ) {
      return 'rate_limited';
    }
    return 'failed';
  }
}
