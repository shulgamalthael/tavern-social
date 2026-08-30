import type { JsonSchemaObject, ToolRiskLevel } from '../ai.types';

/**
 * Аналог `ToolContext` (`ai.types.ts`) для AI-4 conversational onboarding
 * (AI_PLATFORM_ROADMAP.md §2.7) — намеренно БЕЗ `businessId`: на момент
 * онбординг-диалога бизнеса ещё не существует, это как раз то, что диалог
 * создаёт. Отдельный тип, а не `ToolContext` с опциональным `businessId` —
 * так у каждого онбординг-инструмента типобезопасно нет доступа к
 * business-scoped операциям (`WebsitesService.saveDraft` и т.п.), даже по
 * ошибке — тот же принцип узкого допустимого множества, что и curated
 * allowlist у `add_block` (AI_PLATFORM_ROADMAP.md §8).
 */
export interface OnboardingToolContext {
  actorId: string;
}

/**
 * Аналог `ToolDefinition` (`ai.types.ts`), но для `OnboardingToolContext` —
 * см. её комментарий про то, почему это отдельный тип, а не переиспользование
 * business-scoped варианта с опциональным полем.
 */
export interface OnboardingToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  parameters: JsonSchemaObject;
  parseInput: (raw: unknown) => TInput;
  handler: (input: TInput, ctx: OnboardingToolContext) => Promise<TOutput>;
}

/**
 * Аналог `AiStreamEvent`, но для онбординг-диалога — с одним дополнительным
 * вариантом, `business_created`: frontend должен детерминированно узнать
 * `businessId`/`slug` только что созданного бизнеса, чтобы перейти в
 * конструктор (`/business/[id]/edit`, тот же переход, что и у ручной формы
 * `CreateBusinessForm`, см. AI_PLATFORM_ROADMAP.md §2.7), не парся
 * произвольный `resultSummary` конкретного инструмента на frontend.
 */
export type OnboardingStreamEvent =
  | { type: 'tool_start'; tool: string; riskLevel: ToolRiskLevel }
  | { type: 'tool_result'; tool: string; riskLevel: ToolRiskLevel; status: 'success' | 'error' }
  | { type: 'business_created'; businessId: string; slug: string }
  | { type: 'message'; message: string };
