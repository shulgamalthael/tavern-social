import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import {
  LlmProvider,
  type LlmChatResult,
  type LlmMessage,
  type LlmToolCall,
  type LlmToolSchema,
} from '../llm-provider';
import { GeminiRetriesExhaustedError } from '../quota/gemini-quota.errors';
import { GeminiQuotaService } from '../quota/gemini-quota.service';
import {
  computeGeminiBackoffDelayMs,
  parseGeminiRetryAfterMs,
  sleep,
} from '../quota/gemini-quota.lib';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
  /** Картинка/файл как часть хода `role: 'user'` (`LlmMessage.attachments`)
   * — официальный формат `generateContent` для мультимодального ввода,
   * `data` без префикса `data:...;base64,`. */
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: unknown };
  functionResponse?: { name: string; response: unknown };
  /** Обязателен для многошагового tool-calling на "thinking"-моделях (Gemini
   * 3.x) — без него повторный запрос с историей вызова падает 400 "missing
   * thought_signature" (проверено на реальном API, не по документации:
   * `gemini-3.6-flash` требует это на практике). Официально — непрозрачная
   * строка, которую нужно вернуть ровно в том виде, в котором её прислала
   * модель, на той же `functionCall`-части. См. `LlmToolCall.providerMetadata`. */
  thoughtSignature?: string;
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { role: string; parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  /** Реальный расход токенов ЭТОГО вызова, как его считает сам Gemini — не
   * задокументировано в типах, но реально присутствует в ответе
   * `generateContent` (проверено на реальном ответе API, не по памяти) —
   * источник `LlmChatResult.usage` для Cost Engine/TPM-учёта
   * (`AiRequestAccountingService`). */
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Реализация `LlmProvider` поверх REST `generateContent` (не SDK — прямой
 * `fetch`, чтобы не тянуть новую зависимость ради одного эндпоинта и не
 * зависеть от версии стороннего SDK — тот же уровень риска, что и с любой
 * npm-либой, но без неё вообще). Формат запроса/ответа — см. официальный
 * REST-референс `https://ai.google.dev/api/generate-content` (проверено
 * при реализации, не по памяти): `contents[].role` — `user`/`model`,
 * `parts[]` — `text` | `functionCall` | `functionResponse`; результат
 * функции отправляется обратно как `role: 'user'` с частью
 * `functionResponse` (у Gemini, в отличие от OpenAI, нет отдельной роли
 * `tool` и нет id вызова в ответе — сопоставление по имени, см.
 * `toGeminiContent` ниже).
 */
@Injectable()
export class GeminiAdapter extends LlmProvider {
  private readonly logger = new Logger(GeminiAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    configService: ConfigService,
    private readonly quota: GeminiQuotaService,
  ) {
    super();
    const config = configService.get<AppConfig>('app')!;
    this.apiKey = config.geminiApiKey;
    this.model = config.geminiModel;
    this.maxRetries = config.geminiMaxRetries;
    this.retryBaseDelayMs = config.geminiRetryBaseDelayMs;

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY не задан — AI-чат отключён (см. AI_PLATFORM_ROADMAP.md §5)');
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== undefined;
  }

  async chat(
    messages: LlmMessage[],
    tools: LlmToolSchema[],
    systemInstruction: string,
    operation: string,
  ): Promise<LlmChatResult> {
    if (!this.apiKey) {
      throw new Error('GeminiAdapter.chat вызван без настроенного GEMINI_API_KEY');
    }

    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: messages.map(toGeminiContent),
      ...(tools.length > 0
        ? {
            tools: [
              {
                functionDeclarations: tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                })),
              },
            ],
          }
        : {}),
    };

    const payload = await this.sendWithQuotaAndRetry(body, operation);

    if (payload.promptFeedback?.blockReason) {
      throw new Error(`Gemini заблокировал запрос: ${payload.promptFeedback.blockReason}`);
    }

    const parts = payload.candidates?.[0]?.content?.parts ?? [];

    const textParts = parts
      .filter((part): part is GeminiPart & { text: string } => typeof part.text === 'string')
      .map((part) => part.text);

    const toolCalls: LlmToolCall[] = parts
      .filter(
        (part): part is GeminiPart & { functionCall: { name: string; args?: unknown } } =>
          part.functionCall !== undefined,
      )
      .map((part, index) => ({
        id: `${part.functionCall.name}#${index}`,
        name: part.functionCall.name,
        args: part.functionCall.args ?? {},
        providerMetadata: part.thoughtSignature,
      }));

    const usage = payload.usageMetadata
      ? {
          inputTokens: payload.usageMetadata.promptTokenCount ?? 0,
          outputTokens: payload.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens:
            payload.usageMetadata.totalTokenCount ??
            (payload.usageMetadata.promptTokenCount ?? 0) +
              (payload.usageMetadata.candidatesTokenCount ?? 0),
        }
      : undefined;

    return {
      message: textParts.length > 0 ? textParts.join('\n') : null,
      toolCalls,
      usage,
    };
  }

  /** Единственное место, где реально идёт `fetch` к Gemini — резервирует
   * RPM/RPD-слот через `GeminiQuotaService` ПЕРЕД каждой попыткой (включая
   * повторные после 429, см. её комментарий) и ограниченно ретраит 429 с
   * backoff'ом, а не падает на первом же отказе (GEMINI OPTIMIZATION §26-27:
   * "никогда не делать retry без строгого ограничения", "если RPD исчерпан —
   * не отправлять дополнительные запросы"). Не-429 ошибки (сеть, 5xx,
   * заблокированный промпт) НЕ ретраятся — они не про квоту и повтор с тем же
   * телом с высокой вероятностью повторит тот же результат. */
  private async sendWithQuotaAndRetry(
    body: unknown,
    operation: string,
  ): Promise<GeminiGenerateContentResponse> {
    let attempt = 0;

    for (;;) {
      // Бросает `GeminiRpdExceededError`/`GeminiRpmQueueTimeoutError`, если
      // слот получить не удалось (дневной лимит исчерпан или очередь на RPM
      // не рассосалась за отведённое время) — оба уже `HttpException` с
      // понятным сообщением, дальше их незачем оборачивать.
      await this.quota.waitForSlot(operation);

      let response: Response;
      try {
        response = await fetch(`${GEMINI_API_BASE}/${this.model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey!,
          },
          body: JSON.stringify(body),
        });
      } catch (networkError) {
        await this.quota.recordOutcome(operation, 'failed');
        throw new Error(
          `Gemini API недоступен: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
        );
      }

      if (response.status === 429) {
        await this.quota.recordOutcome(operation, '429');
        attempt += 1;
        if (attempt > this.maxRetries) {
          throw new GeminiRetriesExhaustedError();
        }

        const retryAfterMs =
          parseGeminiRetryAfterMs(response.headers.get('retry-after')) ??
          computeGeminiBackoffDelayMs(attempt, this.retryBaseDelayMs);
        this.logger.warn(
          `[${operation}] Gemini ответил 429, попытка ${attempt}/${this.maxRetries} через ${retryAfterMs}мс`,
        );
        await sleep(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        await this.quota.recordOutcome(operation, 'failed');
        const errorText = await response.text();
        throw new Error(`Gemini API ответил ${response.status}: ${errorText}`);
      }

      await this.quota.recordOutcome(operation, 'success');
      return (await response.json()) as GeminiGenerateContentResponse;
    }
  }
}

function toGeminiContent(message: LlmMessage): GeminiContent {
  if (message.role === 'user') {
    const parts: GeminiPart[] = [{ text: message.content ?? '' }];
    for (const attachment of message.attachments ?? []) {
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
    }
    return { role: 'user', parts };
  }

  if (message.role === 'assistant') {
    const parts: GeminiPart[] = [];
    if (message.content) parts.push({ text: message.content });
    for (const call of message.toolCalls ?? []) {
      parts.push({
        functionCall: { name: call.name, args: call.args },
        ...(typeof call.providerMetadata === 'string'
          ? { thoughtSignature: call.providerMetadata }
          : {}),
      });
    }
    return { role: 'model', parts };
  }

  return {
    role: 'user',
    parts: [
      {
        functionResponse: {
          name: message.toolName ?? '',
          response: parseToolResultJson(message.content),
        },
      },
    ],
  };
}

/** Результат инструмента `AiService` кладёт в `content` через
 * `JSON.stringify` (см. её комментарий) — здесь всегда валидный JSON,
 * `catch` — только защита от будущей ошибки вызывающего кода, не ожидаемый путь. */
function parseToolResultJson(content: string | undefined): unknown {
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}
