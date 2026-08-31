import type { PlanTier } from '../model/types';

/** Уровень возможности на тарифе — текстовые уровни, не количество галочек:
 * "✓✓✓" неоднозначно читается в таблице сравнения, а "Продвинутый" —
 * однозначно (см. §14 исходного brief'а "Growth & Advertising" — категория
 * сравнения тарифов). v0 — статичная TS-константа, тот же принцип, что у
 * `PLAN_CATALOG` (см. его комментарий): 5 неизменных колонок не стоят
 * отдельного backend-эндпоинта. */
export type ComparisonLevel = 'none' | 'basic' | 'advanced' | 'custom';

export interface GrowthComparisonRow {
  id: string;
  label: string;
  levels: Record<PlanTier, ComparisonLevel>;
}

/** Пункты сравнения — ровно список из §14 brief'а "COMPARISON MODE", уровни
 * по тарифам подобраны по описаниям соответствующих Growth Strategy разделов
 * (§3-7 того же brief'а), не наугад: например, Forecasting/Experimentation
 * впервые появляются на Scale — это буквально то, что написано в её секции
 * "AI Optimization"/"Experimentation". */
export const GROWTH_ADVERTISING_COMPARISON: readonly GrowthComparisonRow[] = [
  {
    id: 'growth-analysis',
    label: 'AI Growth Analysis',
    levels: {
      free: 'basic',
      starter: 'basic',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'campaign-strategy',
    label: 'Campaign Strategy',
    levels: {
      free: 'basic',
      starter: 'basic',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'ai-creative-generation',
    label: 'AI Creative Generation',
    levels: {
      free: 'none',
      starter: 'basic',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'conversion-tracking',
    label: 'Conversion Tracking',
    levels: {
      free: 'basic',
      starter: 'basic',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'retargeting',
    label: 'Retargeting',
    levels: {
      free: 'none',
      starter: 'basic',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'multichannel-advertising',
    label: 'Multi-Channel Advertising',
    levels: {
      free: 'none',
      starter: 'none',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'ai-optimization',
    label: 'AI Optimization',
    levels: {
      free: 'none',
      starter: 'basic',
      business: 'advanced',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'campaign-automation',
    label: 'Campaign Automation',
    levels: {
      free: 'none',
      starter: 'none',
      business: 'basic',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'forecasting',
    label: 'Forecasting',
    levels: {
      free: 'none',
      starter: 'none',
      business: 'none',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'experimentation',
    label: 'Experimentation',
    levels: {
      free: 'none',
      starter: 'none',
      business: 'none',
      scale: 'advanced',
      enterprise: 'custom',
    },
  },
  {
    id: 'custom-attribution',
    label: 'Custom Attribution',
    levels: {
      free: 'none',
      starter: 'none',
      business: 'none',
      scale: 'none',
      enterprise: 'custom',
    },
  },
];
