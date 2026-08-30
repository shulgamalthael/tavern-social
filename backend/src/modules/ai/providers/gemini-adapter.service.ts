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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiPart {
  text?: string;
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

  constructor(configService: ConfigService) {
    super();
    const config = configService.get<AppConfig>('app')!;
    this.apiKey = config.geminiApiKey;
    this.model = config.geminiModel;

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

    const response = await fetch(`${GEMINI_API_BASE}/${this.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API ответил ${response.status}: ${errorText}`);
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;

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

    return {
      message: textParts.length > 0 ? textParts.join('\n') : null,
      toolCalls,
    };
  }
}

function toGeminiContent(message: LlmMessage): GeminiContent {
  if (message.role === 'user') {
    return { role: 'user', parts: [{ text: message.content ?? '' }] };
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
