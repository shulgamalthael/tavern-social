import type { ToolRiskLevel as PrismaToolRiskLevel } from '@prisma/client';

/** Тот же enum, что и в схеме (`AuditLog.riskLevel`) — переиспользуем
 * сгенерированный Prisma-тип, а не заводим параллельный string-union,
 * чтобы значение инструмента и значение, реально попадающее в БД, не могли
 * разойтись. */
export type ToolRiskLevel = PrismaToolRiskLevel;

export interface ToolContext {
  actorId: string;
  /** Бизнес, в контексте которого идёт диалог — ВСЕГДА берётся из
   * серверного контекста запроса (`AiController` → `AiService.chat`),
   * никогда не передаётся моделью как параметр инструмента (ни один
   * `ToolDefinition.parameters` в этом модуле не должен объявлять поле
   * `businessId`). Так исключается сам класс атаки «модель просит
   * инструмент с чужим businessId» — см. `AI_PLATFORM_ROADMAP.md` §0.1 про
   * то, что tenant-изоляция в этом проекте — это `Business.ownerId`. */
  businessId: string;
}

/** Минимальное подмножество JSON Schema, которого достаточно для
 * `functionDeclarations.parameters` в Gemini function calling (см.
 * `GeminiAdapter`) — не полная спецификация JSON Schema, только то, что
 * реально нужно для описания параметров инструментов этого модуля. */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
}

/**
 * Один AI-инструмент — маленький, самодостаточный (mission §59
 * "composable tools", AI_PLATFORM_ROADMAP.md §2.1). `TInput`/`TOutput`
 * типизируют конкретный инструмент в месте его определения; в
 * `ToolRegistryService` тип стирается до `unknown` (см. её комментарий) —
 * реестр по определению хранит разнородные инструменты.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  parameters: JsonSchemaObject;
  /** Валидирует и парсит сырые аргументы, присланные моделью, в
   * типизированный `TInput` — бросает при несоответствии схеме, ДО вызова
   * `handler` (модель — untrusted input, mission §20/§97, см.
   * AI_PLATFORM_ROADMAP.md §3 про конкретную дыру, которую это закрывает
   * для website-document инструментов). */
  parseInput: (raw: unknown) => TInput;
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

export interface ToolExecutionSummary {
  tool: string;
  riskLevel: ToolRiskLevel;
  status: 'success' | 'error';
}

export interface ChatResult {
  message: string;
  toolExecutions: ToolExecutionSummary[];
}

/**
 * Один прогресс-эвент цикла `AiService`'s `runToolLoop` (AI-3, стриминг —
 * см. AI_PLATFORM_ROADMAP.md, фаза AI-3). `chat()` (не-стриминговый,
 * AI-1/AI-2) сворачивает поток таких эвентов обратно в единый `ChatResult`;
 * `chatStream()` отдаёт их как есть через SSE (`AiController`), по одному
 * эвенту на `data:`-фрейм. Ошибки цикла (лимит итераций, сбой LLM без ранее
 * выполненных инструментов) НЕ моделируются отдельным вариантом здесь — они
 * пробрасываются как исключение (см. комментарий `runToolLoop`), и для SSE
 * попадают в стандартный `event: error` Nest'а самостоятельно.
 */
export type AiStreamEvent =
  | { type: 'tool_start'; tool: string; riskLevel: ToolRiskLevel }
  | { type: 'tool_result'; tool: string; riskLevel: ToolRiskLevel; status: 'success' | 'error' }
  | { type: 'message'; message: string };

/**
 * Одна запись "ленты активности" AI для бизнеса (AI-3, третий пункт mission
 * §39-42 — "activity timeline") — урезанная проекция `AuditLog` для чтения
 * владельцем бизнеса: только то, что нужно показать "что AI сделал и
 * когда", БЕЗ `argsSummary`/`resultSummary` (это внутренний диагностический
 * срез аудит-лога для разработчиков, не пользовательский UI). В отличие от
 * истории диалога в `AiChatPanel` (живёт в `useState`, теряется при
 * перезагрузке страницы), эта лента читается из БД и переживает
 * перезагрузку и смену вкладки/устройства.
 */
export interface AuditLogListItem {
  id: string;
  tool: string;
  riskLevel: ToolRiskLevel;
  status: 'success' | 'error';
  createdAt: string;
}
