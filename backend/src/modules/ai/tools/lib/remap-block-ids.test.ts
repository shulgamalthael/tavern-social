import { describe, expect, it } from 'vitest';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import { remapBlockIds } from './remap-block-ids';

describe('remapBlockIds', () => {
  it('assigns a fresh id, different from the original', () => {
    const block: WebsiteBlock = { id: 'original-id', type: 'heading', props: { text: 'Hi' } };
    const remapped = remapBlockIds(block);
    expect(remapped.id).not.toBe('original-id');
    expect(remapped.type).toBe('heading');
    expect(remapped.props).toEqual({ text: 'Hi' });
  });

  it('does not mutate the input block', () => {
    const block: WebsiteBlock = { id: 'original-id', type: 'text', props: {} };
    remapBlockIds(block);
    expect(block.id).toBe('original-id');
  });

  it('recursively remaps nested children with distinct fresh ids', () => {
    const block: WebsiteBlock = {
      id: 'parent',
      type: 'section',
      props: {},
      children: [
        { id: 'child-1', type: 'heading', props: {} },
        { id: 'child-2', type: 'text', props: {} },
      ],
    };
    const remapped = remapBlockIds(block);

    expect(remapped.children).toHaveLength(2);
    const [child1, child2] = remapped.children!;
    expect(child1.id).not.toBe('child-1');
    expect(child2.id).not.toBe('child-2');
    expect(child1.id).not.toBe(child2.id);
    expect(remapped.id).not.toBe(child1.id);
  });

  it('leaves a block with no children as-is besides the id', () => {
    const block: WebsiteBlock = { id: 'leaf', type: 'spacer', props: { height: 'md' } };
    const remapped = remapBlockIds(block);
    expect(remapped.children).toBeUndefined();
  });

  it('produces distinct ids across two separate calls on the same input (two insertions of the same widget)', () => {
    const block: WebsiteBlock = { id: 'original', type: 'heading', props: {} };
    const first = remapBlockIds(block);
    const second = remapBlockIds(block);
    expect(first.id).not.toBe(second.id);
  });
});
