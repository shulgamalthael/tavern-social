import { describe, expect, it } from 'vitest';
import type { LlmMessage } from '../llm-provider';
import { computeAiRequestFingerprint } from './ai-dedup-cache.lib';

const MESSAGES: LlmMessage[] = [{ role: 'user', content: 'Привет' }];

describe('computeAiRequestFingerprint', () => {
  it('is deterministic for identical input', () => {
    const a = computeAiRequestFingerprint('business_chat', 'biz-1', MESSAGES);
    const b = computeAiRequestFingerprint('business_chat', 'biz-1', MESSAGES);
    expect(a).toBe(b);
  });

  it('differs by operation', () => {
    const a = computeAiRequestFingerprint('business_chat', 'biz-1', MESSAGES);
    const b = computeAiRequestFingerprint('onboarding_chat', 'biz-1', MESSAGES);
    expect(a).not.toBe(b);
  });

  it('differs by businessId', () => {
    const a = computeAiRequestFingerprint('business_chat', 'biz-1', MESSAGES);
    const b = computeAiRequestFingerprint('business_chat', 'biz-2', MESSAGES);
    expect(a).not.toBe(b);
  });

  it('differs by message content, so later rounds of the same tool loop get distinct fingerprints', () => {
    const round1: LlmMessage[] = [{ role: 'user', content: 'Привет' }];
    const round2: LlmMessage[] = [
      { role: 'user', content: 'Привет' },
      { role: 'assistant', toolCalls: [{ id: 't1', name: 'get_project_tree', args: {} }] },
      { role: 'tool', toolCallId: 't1', toolName: 'get_project_tree', content: '{}' },
    ];
    expect(computeAiRequestFingerprint('business_chat', 'biz-1', round1)).not.toBe(
      computeAiRequestFingerprint('business_chat', 'biz-1', round2),
    );
  });

  it('treats undefined businessId consistently', () => {
    const a = computeAiRequestFingerprint('onboarding_chat', undefined, MESSAGES);
    const b = computeAiRequestFingerprint('onboarding_chat', undefined, MESSAGES);
    expect(a).toBe(b);
  });
});
