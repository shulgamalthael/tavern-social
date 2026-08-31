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

/** AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — `high`/`critical` вызов, уже
 * провалидированный на backend, но не выполненный: ход диалога
 * останавливается здесь, владелец подтверждает/отклоняет через
 * `confirmToolCall`/`rejectToolCall` (`confirmationId` — id соответствующей
 * `pending`-строки `AuditLog` на backend, не что-то, что этот клиент сам
 * придумывает). */
export interface ConfirmRequiredInfo {
  tool: string;
  riskLevel: ToolRiskLevel;
  confirmationId: string;
}

/** Один эвент из SSE-потока `POST /businesses/:businessId/ai/chat/stream`
 * (`data:`-фрейм со стандартным именем эвента, т.е. без `event:`-строки) —
 * см. `AiStreamEvent` в backend `ai.types.ts`. `event: error`-фреймы (сбой
 * LLM-провайдера/превышение лимита итераций хода, которые Nest формирует
 * сам через `catchError`) — отдельный, не-JSON случай, см. `stream-ai-chat.ts`. */
export type AiStreamEvent =
  | { type: 'tool_start'; tool: string; riskLevel: ToolRiskLevel }
  | { type: 'tool_result'; tool: string; riskLevel: ToolRiskLevel; status: 'success' | 'error' }
  | { type: 'message'; message: string }
  | ({ type: 'confirm_required' } & ConfirmRequiredInfo);

/** Одна запись ленты активности AI (AI-3, "activity timeline", зеркало
 * backend `AuditLogListItem` в `ai.types.ts`) — в отличие от `AiChatMessage`
 * ниже, читается из БД (`GET /businesses/:businessId/ai/activity`), а не
 * копится в `useState`: переживает перезагрузку страницы и смену вкладки,
 * но не несёт текста диалога — только что за инструмент выполнился и когда. */
export interface AiActivityItem {
  id: string;
  tool: string;
  riskLevel: ToolRiskLevel;
  /** `pending`/`rejected` — AI-9's confirm-флоу: владелец видит в ленте, что
   * AI ждёт подтверждения или что он его отклонил, не только уже
   * случившиеся success/error. */
  status: 'success' | 'error' | 'pending' | 'rejected';
  createdAt: string;
}

/** UI-уровневая модель одной реплики в истории чата — добавляет то, что
 * нужно только рендеру (роль, стабильный `id` для React-ключа, флаг ошибки
 * отправки). `toolExecutions` теперь может дополняться по одному элементу
 * по мере прихода `tool_result`-эвентов (AI-3, стриминг), а не одним блоком
 * в конце хода, как раньше (AI-2, единственный запрос-ответ). */
/** Состояние карточки подтверждения (AI-9) внутри одной реплики ассистента
 * — `awaiting` показывает кнопки «Подтвердить»/«Отклонить», остальные
 * значения — уже принятое или в процессе принятия решение (кнопки
 * скрыты/задизейблены, показан итог). Живёт целиком в `useState` этой
 * панели, как и вся история диалога — переживает только пока смонтирован
 * билдер, не персистится. */
export interface PendingConfirmation extends ConfirmRequiredInfo {
  resolution: 'awaiting' | 'confirming' | 'rejecting' | 'confirmed' | 'confirm_failed' | 'rejected';
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolExecutions?: ToolExecutionSummary[];
  isError?: boolean;
  pendingConfirmation?: PendingConfirmation;
}
