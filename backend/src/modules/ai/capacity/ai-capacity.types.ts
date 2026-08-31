import type { AiAlertSeverity, AiPriority } from '@prisma/client';
import type { AiCapacityStatus } from './ai-capacity.lib';

/** Контекст одного AI-хода, передаваемый `AiGatewayService.chat()` вызывающим
 * кодом (`AiService`/`AiOnboardingService`) — заменяет голую строку
 * `operation` из прошлой итерации: Gateway теперь должен знать businessId
 * (budget-проверка per-business) и actorId (аномалии per-actor), не только
 * тег операции. */
export interface AiRequestContext {
  operation: string;
  businessId?: string;
  actorId?: string;
}

export interface RecordAiRequestInput extends AiRequestContext {
  model: string;
  status: 'success' | 'failed' | 'rate_limited';
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  errorMessage?: string;
}

export interface AiUsageByOperation {
  operation: string;
  requestCount: number;
  totalTokens: number;
  costMicros: number;
}

export interface AiUsageByBusiness {
  businessId: string;
  requestCount: number;
  totalTokens: number;
  costMicros: number;
}

export interface AiCapacitySnapshotDto {
  rpm: { used: number; safetyLimit: number; officialLimit: number; usedPercent: number };
  rpd: { used: number; safetyLimit: number; officialLimit: number; usedPercent: number };
  tpm: { used: number };
  status: AiCapacityStatus;
}

export interface AiCostSummaryDto {
  todayCostMicros: number;
  monthCostMicros: number;
  todayRequestCount: number;
  monthRequestCount: number;
}

export interface AiBudgetStatusDto {
  scope: 'global' | 'business';
  businessId: string | null;
  monthlyLimitCents: number;
  spentMicros: number;
  remainingMicros: number;
  spentPercent: number;
}

export interface AiAlertDto {
  id: string;
  type: string;
  severity: AiAlertSeverity;
  message: string;
  createdAt: string;
}

export interface AiAnomalyDto {
  id: string;
  type: string;
  description: string;
  detectedAt: string;
}

export interface AiRecommendationDto {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface AiForecastDto {
  sufficientData: boolean;
  averageDailyGrowthPercent: number;
  projectedRequestsIn30Days: number;
  daysUntilCapacityInsufficient: number | null;
}

export interface AiInfrastructureOverviewDto {
  capacity: AiCapacitySnapshotDto;
  cost: AiCostSummaryDto;
  forecast: AiForecastDto;
  budgets: AiBudgetStatusDto[];
  topOperations: AiUsageByOperation[];
  topBusinesses: AiUsageByBusiness[];
  recentAlerts: AiAlertDto[];
  recentAnomalies: AiAnomalyDto[];
  recommendations: AiRecommendationDto[];
  /** §14/§15 brief'а — Gemini не предоставляет публичный API текущего usage
   * tier/лимитов (в отличие от того, что brief предполагает для OpenAI) —
   * честно помечаем как недоступное, а не изображаем интеграцию, которой
   * нет. `currentLimits` при этом РЕАЛЬНЫ — это наша же конфигурация
   * (`GEMINI_RPM_LIMIT`/`GEMINI_RPD_LIMIT`), не выдумка. */
  tierInfo: {
    providerTierDetectionAvailable: false;
    currentLimits: { rpm: number; rpd: number };
  };
}

export type { AiPriority };
