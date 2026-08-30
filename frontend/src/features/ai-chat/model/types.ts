/** Зеркало backend `ChatResult`/`ToolExecutionSummary`
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

export interface AiChatResult {
  message: string;
  toolExecutions: ToolExecutionSummary[];
}

/** UI-уровневая модель одной реплики в истории чата — `AiChatResult` выше
 * описывает только ОТВЕТ backend, этот тип добавляет то, что нужно только
 * рендеру (роль, стабильный `id` для React-ключа, флаг ошибки отправки). */
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolExecutions?: ToolExecutionSummary[];
  isError?: boolean;
}
