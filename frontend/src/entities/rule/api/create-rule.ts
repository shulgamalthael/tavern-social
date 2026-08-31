'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Rule, RuleAction, RuleConditionNode, RuleTrigger } from '../model/types';

export interface CreateRuleInput {
  name: string;
  trigger: RuleTrigger;
  condition: RuleConditionNode[] | null;
  actions: RuleAction[];
  isEnabled?: boolean;
}

export async function createRule(businessId: string, input: CreateRuleInput): Promise<Rule> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Rule>(`/businesses/${businessId}/rules`, {
    method: 'POST',
    token,
    body: input,
  });
}
