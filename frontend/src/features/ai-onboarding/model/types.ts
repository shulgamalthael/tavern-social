/** Зеркало backend `OnboardingStreamEvent`
 * (`backend/src/modules/ai/onboarding/onboarding.types.ts`) — тот же приём,
 * что у `features/ai-chat/model/types.ts` для `AiStreamEvent`: независимые,
 * вручную синхронизированные копии формы одного контракта, без общего
 * npm-пакета типов между frontend/backend. */

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type OnboardingStreamEvent =
  | { type: 'tool_start'; tool: string; riskLevel: ToolRiskLevel }
  | { type: 'tool_result'; tool: string; riskLevel: ToolRiskLevel; status: 'success' | 'error' }
  | { type: 'business_created'; businessId: string; slug: string; templateId: string }
  | { type: 'message'; message: string };

/** UI-уровневая модель одной реплики диалога — та же форма, что и
 * `AiChatMessage` в `features/ai-chat`, без `toolExecutions`-баджей: в
 * онбординге ровно один инструмент (`create_business`), его результат
 * выражается переходом в конструктор (см. `business_created` выше), а не
 * списком баджей под пузырём. */
export interface AiOnboardingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}
