import { describe, expect, it } from 'vitest';
import { insertBlock, remapBlockIds } from './block-tree';
import type { WebsiteBlock } from './types';

describe('remapBlockIds', () => {
  it('assigns a fresh id, leaving type/props untouched', () => {
    const block: WebsiteBlock = { id: 'original', type: 'heading', props: { text: 'Hi' } };
    const remapped = remapBlockIds(block);

    expect(remapped.id).not.toBe('original');
    expect(remapped.type).toBe('heading');
    expect(remapped.props).toEqual({ text: 'Hi' });
  });

  it('recursively remaps children, each with its own fresh id', () => {
    const block: WebsiteBlock = {
      id: 'section',
      type: 'columns',
      props: {},
      children: [
        { id: 'a', type: 'heading', props: {} },
        { id: 'b', type: 'text', props: {} },
      ],
    };
    const remapped = remapBlockIds(block);

    expect(remapped.id).not.toBe('section');
    expect(remapped.children).toHaveLength(2);
    expect(remapped.children?.[0].id).not.toBe('a');
    expect(remapped.children?.[1].id).not.toBe('b');
    // Two remaps of the same tree never collide with each other either.
    const secondRemap = remapBlockIds(block);
    expect(secondRemap.id).not.toBe(remapped.id);
  });

  it('does not add a children key to a block that never had one', () => {
    const block: WebsiteBlock = { id: 'x', type: 'spacer', props: {} };
    const remapped = remapBlockIds(block);
    expect('children' in remapped).toBe(false);
  });
});

describe('insertBlock applied repeatedly (as insertWidgetBlocks does)', () => {
  it('inserts several blocks in order at increasing indices', () => {
    const existing: WebsiteBlock[] = [{ id: 'first', type: 'heading', props: {} }];
    const widgetBlocks: WebsiteBlock[] = [
      { id: 'w1', type: 'heading', props: { text: 'A' } },
      { id: 'w2', type: 'text', props: { text: 'B' } },
    ];

    let result = existing;
    widgetBlocks.forEach((block, offset) => {
      result = insertBlock(result, block, null, existing.length + offset);
    });

    expect(result.map((block) => block.id)).toEqual(['first', 'w1', 'w2']);
  });

  it('inserting the same widget schema twice produces four distinct, correctly ordered block ids', () => {
    // Same loop shape as `website-store.ts`'s `insertWidgetBlocks`: fresh ids
    // once per insertion batch, each block placed at a fixed starting index
    // plus its offset within the batch.
    const widgetSchema: WebsiteBlock[] = [
      { id: 'saved-1', type: 'heading', props: { text: 'A' } },
      { id: 'saved-2', type: 'text', props: { text: 'B' } },
    ];

    function insertWidget(page: WebsiteBlock[]): WebsiteBlock[] {
      const fresh = widgetSchema.map(remapBlockIds);
      let result = page;
      const startIndex = page.length;
      fresh.forEach((block, offset) => {
        result = insertBlock(result, block, null, startIndex + offset);
      });
      return result;
    }

    const page = insertWidget(insertWidget([]));

    expect(page).toHaveLength(4);
    expect(page.map((block) => block.type)).toEqual(['heading', 'text', 'heading', 'text']);
    expect(new Set(page.map((block) => block.id)).size).toBe(4);
  });
});
