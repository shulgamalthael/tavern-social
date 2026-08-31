import { IsIn } from 'class-validator';
import { SELECTABLE_PLAN_TIERS, type SelectablePlanTier } from '../billing.types';

export class SelectPlanDto {
  @IsIn(SELECTABLE_PLAN_TIERS, { message: 'Тир должен быть free, starter, business или scale' })
  tier!: SelectablePlanTier;
}
