import type { JsonSchemaObject } from './ai.types';

export interface LlmToolCall {
  /** Синтетический id, сгенерированный адаптером (не все провайдеры, в
   * т.ч. Gemini, отдают собственный id вызова) — используется только для
   * сопоставления `LlmMessage` с ролью `tool` со своим вызовом внутри ОДНОГО
   * хода оркестрации, не персистится нигде. */
  id: string;
  name: string;
  args: unknown;
  /** Непрозрачные данные конкретного провайдера, которые нужно вернуть
   * ЕМУ ЖЕ без изменений в следующем ходу — `AiService` их не разбирает и
   * не трогает, только хранит вместе с вызовом и отдаёт обратно как есть.
   * Пример — Gemini `thoughtSignature` на "thinking"-моделях (обязателен
   * для многошагового tool-calling, см. `GeminiAdapter`); у провайдера без
   * такого механизма (например, будущего OpenAI-адаптера) остаётся
   * `undefined`. */
  providerMetadata?: unknown;
}

export interface LlmMessage {
  role: 'user' | 'assistant' | 'tool';
  /** Обязателен для `user`; опционален для `assistant` (модель могла и
   * ничего не сказать текстом, только запросить инструменты) и для `tool`
   * (JSON-результат инструмента, сериализованный строкой). */
  content?: string;
  /** Только при `role: 'assistant'`, когда модель запросила вызов инструмента(ов). */
  toolCalls?: LlmToolCall[];
  /** Только при `role: 'tool'` — какой вызов (см. `LlmToolCall.id`) этот
   * результат закрывает. */
  toolCallId?: string;
  /** Только при `role: 'tool'` — имя инструмента; продублировано с `id`
   * намеренно, т.к. не у всех провайдеров матчинг вызов↔результат идёт по
   * id (Gemini сопоставляет по имени, см. `GeminiAdapter`). */
  toolName?: string;
}

export interface LlmToolSchema {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
}

export interface LlmChatResult {
  /** `null`, если ход модели — только запрос инструмента(ов), без
   * сопроводительного текста. */
  message: string | null;
  toolCalls: LlmToolCall[];
}

/**
 * Абстракция над LLM-провайдером (тот же приём, что уже есть в проекте —
 * `PaymentProvider`, `backend/src/modules/payments/payment-provider.ts`):
 * `AiService` зависит только от этого класса, не от конкретного провайдера
 * напрямую. Сегодня единственная реализация — `GeminiAdapter`; смена на
 * другого провайдера (см. AI_PLATFORM_ROADMAP.md §2.3) — это новый adapter-
 * класс плюс один binding в `AiModule`, без изменений в `AiService`/tools.
 */
export abstract class LlmProvider {
  /** `false`, если ключ провайдера не задан в `.env` — вызывающий код
   * (`AiService.chat`) в этом случае отвечает понятной ошибкой, а не падает
   * (тот же принцип, что у `PaymentProvider.isConfigured()`). */
  abstract isConfigured(): boolean;

  abstract chat(
    messages: LlmMessage[],
    tools: LlmToolSchema[],
    systemInstruction: string,
  ): Promise<LlmChatResult>;
}
