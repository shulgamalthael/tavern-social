'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Rule, RuleAction, RuleConditionNode } from '../model/types';

export interface UpdateRuleInput {
  name?: string;
  condition?: RuleConditionNode[] | null;
  actions?: RuleAction[];
  isEnabled?: boolean;
}

export async function updateRule(
  businessId: string,
  ruleId: string,
  input: UpdateRuleInput,
): Promise<Rule> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  return backendFetch<Rule>(`/businesses/${businessId}/rules/${ruleId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}
