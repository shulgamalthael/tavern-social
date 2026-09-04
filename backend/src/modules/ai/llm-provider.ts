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
  /** Только при `role: 'user'` — картинки/файлы, прикреплённые к этому ходу
   * диалога (base64, без префикса `data:...;base64,`). Живут ровно один
   * вызов `chat()`: `AiService.runToolLoop` читает их с диска перед первым
   * запросом к провайдеру и удаляет файлы сразу после хода (см. её
   * комментарий) — та же «без памяти между HTTP-вызовами» модель, что и у
   * всего остального диалога здесь. */
  attachments?: { mimeType: string; data: string }[];
}

export interface LlmToolSchema {
  name: string;
  description: string;
  parameters: JsonSchemaObject;
}

/** Реальный расход токенов ОДНОГО вызова `chat()`, как его вернул сам
 * провайдер (Gemini — `usageMetadata`, см. `GeminiAdapter`) — НЕ оценка/
 * подсчёт на нашей стороне. `undefined` у провайдера, который такого не
 * возвращает (пока таких нет, но абстракция не должна требовать usage от
 * каждой реализации). Источник для TPM-учёта и Cost Engine
 * (`AiRequestAccountingService`, AI CAPACITY & COST MANAGER §4/§7). */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmChatResult {
  /** `null`, если ход модели — только запрос инструмента(ов), без
   * сопроводительного текста. */
  message: string | null;
  toolCalls: LlmToolCall[];
  usage?: LlmUsage;
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

  /** `operation` — короткий тег вызывающего хода (например, `business_chat`,
   * `onboarding_chat`), НЕ бизнес-параметр самого запроса к модели — только
   * для централизованной телеметрии/аккаунтинга Gemini-квоты (`GeminiQuotaService`,
   * GEMINI OPTIMIZATION §4/§37: "по какому сценарию тратится RPM/RPD"). У
   * провайдера без такого учёта (гипотетического будущего адаптера) можно
   * просто игнорировать аргумент. */
  abstract chat(
    messages: LlmMessage[],
    tools: LlmToolSchema[],
    systemInstruction: string,
    operation: string,
  ): Promise<LlmChatResult>;
}
