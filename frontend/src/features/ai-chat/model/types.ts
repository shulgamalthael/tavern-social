/** Зеркало backend `AiStreamEvent`/`ToolExecutionSummary`
 * (`backend/src/modules/ai/ai.types.ts`) — тот же приём, что и у
 * `WebsiteDocument` (frontend/backend держат независимые, но
 * синхронизированные вручную копии формы одного и того же контракта, нет
 * общего npm-пакета типов между приложениями). */

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolExecutionSummary {
  tool: string;
  riskLevel: ToolRiskLevel;
  status: 'success' | 'error';
}

/** Один эвент из SSE-потока `POST /businesses/:businessId/ai/chat/stream`
 * (`data:`-фрейм со стандартным именем эвента, т.е. без `event:`-строки) —
 * см. `AiStreamEvent` в backend `ai.types.ts`. `event: error`-фреймы (сбой
 * LLM-провайдера/превышение лимита итераций хода, которые Nest формирует
 * сам через `catchError`) — отдельный, не-JSON случай, см. `stream-ai-chat.ts`. */
export type AiStreamEvent =
  | { type: 'tool_start'; tool: string; riskLevel: ToolRiskLevel }
  | { type: 'tool_result'; tool: string; riskLevel: ToolRiskLevel; status: 'success' | 'error' }
  | { type: 'message'; message: string };

/** Одна запись ленты активности AI (AI-3, "activity timeline", зеркало
 * backend `AuditLogListItem` в `ai.types.ts`) — в отличие от `AiChatMessage`
 * ниже, читается из БД (`GET /businesses/:businessId/ai/activity`), а не
 * копится в `useState`: переживает перезагрузку страницы и смену вкладки,
 * но не несёт текста диалога — только что за инструмент выполнился и когда. */
export interface AiActivityItem {
  id: string;
  tool: string;
  riskLevel: ToolRiskLevel;
  status: 'success' | 'error';
  createdAt: string;
}

/** UI-уровневая модель одной реплики в истории чата — добавляет то, что
 * нужно только рендеру (роль, стабильный `id` для React-ключа, флаг ошибки
 * отправки). `toolExecutions` теперь может дополняться по одному элементу
 * по мере прихода `tool_result`-эвентов (AI-3, стриминг), а не одним блоком
 * в конце хода, как раньше (AI-2, единственный запрос-ответ). */
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolExecutions?: ToolExecutionSummary[];
  isError?: boolean;
}
