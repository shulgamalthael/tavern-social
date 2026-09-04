import { describe, expect, it } from 'vitest';
import type { WebsitePage } from '@/modules/websites/websites.types';
import {
  countDescendants,
  findBlockInPages,
  findParentIdInBlocks,
  insertBlockIntoPage,
  isBlockOrDescendant,
  removeBlockFromPages,
  replaceBlockInPages,
} from './block-tree';

function page(id: string, blocks: WebsitePage['blocks']): WebsitePage {
  return { id, slug: id, title: id, blocks, seoTitle: null, seoDescription: null, ogImage: null };
}

const PAGES: WebsitePage[] = [
  page('home', [
    { id: 'heading-1', type: 'heading', props: { text: 'Hi' } },
    {
      id: 'section-1',
      type: 'section',
      props: {},
      children: [{ id: 'text-1', type: 'text', props: { text: 'Nested' } }],
    },
  ]),
  page('about', [{ id: 'quote-1', type: 'quote', props: { text: 'Q' } }]),
];

describe('findBlockInPages', () => {
  it('finds a top-level block and reports its owning page', () => {
    const found = findBlockInPages(PAGES, 'heading-1');
    expect(found?.page.id).toBe('home');
    expect(found?.block.type).toBe('heading');
  });

  it('finds a block nested inside a container', () => {
    const found = findBlockInPages(PAGES, 'text-1');
    expect(found?.page.id).toBe('home');
    expect(found?.block.type).toBe('text');
  });

  it('finds a block on a different page than the first', () => {
    const found = findBlockInPages(PAGES, 'quote-1');
    expect(found?.page.id).toBe('about');
  });

  it('returns null when the id does not exist anywhere', () => {
    expect(findBlockInPages(PAGES, 'nope')).toBeNull();
  });
});

describe('replaceBlockInPages', () => {
  it('replaces a top-level block without touching siblings', () => {
    const updated = replaceBlockInPages(PAGES, 'heading-1', (block) => ({
      ...block,
      props: { text: 'Changed' },
    }));
    const homePage = updated.find((p) => p.id === 'home')!;
    expect(homePage.blocks[0].props.text).toBe('Changed');
    expect(homePage.blocks[1].id).toBe('section-1');
  });

  it('replaces a nested block without touching its container', () => {
    const updated = replaceBlockInPages(PAGES, 'text-1', (block) => ({
      ...block,
      props: { text: 'Changed nested' },
    }));
    const homePage = updated.find((p) => p.id === 'home')!;
    const section = homePage.blocks[1];
    expect(section.id).toBe('section-1');
    expect(section.children?.[0].props.text).toBe('Changed nested');
  });

  it('leaves the input untouched when the block id is not found', () => {
    const updated = replaceBlockInPages(PAGES, 'nope', (block) => ({
      ...block,
      props: { text: 'should not apply' },
    }));
    expect(updated).toEqual(PAGES);
  });

  it('does not mutate the original pages array', () => {
    const before = JSON.stringify(PAGES);
    replaceBlockInPages(PAGES, 'heading-1', (block) => ({ ...block, props: { text: 'x' } }));
    expect(JSON.stringify(PAGES)).toBe(before);
  });
});

describe('countDescendants', () => {
  it('is 0 for a leaf block', () => {
    expect(countDescendants({ id: 'x', type: 'heading', props: {} })).toBe(0);
  });

  it('counts nested children recursively, not just direct ones', () => {
    const section = PAGES[0].blocks[1];
    expect(countDescendants(section)).toBe(1);
  });
});

describe('isBlockOrDescendant', () => {
  const section = PAGES[0].blocks[1];

  it('is true for the block itself', () => {
    expect(isBlockOrDescendant(section, 'section-1')).toBe(true);
  });

  it('is true for a nested descendant', () => {
    expect(isBlockOrDescendant(section, 'text-1')).toBe(true);
  });

  it('is false for an unrelated block', () => {
    expect(isBlockOrDescendant(section, 'heading-1')).toBe(false);
  });
});

describe('findParentIdInBlocks', () => {
  it('returns null for a top-level block', () => {
    expect(findParentIdInBlocks(PAGES[0].blocks, 'heading-1')).toBeNull();
  });

  it('returns the container id for a nested block', () => {
    expect(findParentIdInBlocks(PAGES[0].blocks, 'text-1')).toBe('section-1');
  });

  it('returns undefined when the id is not found in this tree', () => {
    expect(findParentIdInBlocks(PAGES[0].blocks, 'nope')).toBeUndefined();
  });
});

describe('removeBlockFromPages', () => {
  it('removes a top-level block and returns it', () => {
    const { pages, removed } = removeBlockFromPages(PAGES, 'heading-1');
    expect(removed?.id).toBe('heading-1');
    const homePage = pages.find((p) => p.id === 'home')!;
    expect(homePage.blocks.map((b) => b.id)).toEqual(['section-1']);
  });

  it('removes a nested block together with its own children', () => {
    const { pages, removed } = removeBlockFromPages(PAGES, 'section-1');
    expect(removed?.id).toBe('section-1');
    expect(removed?.children?.[0].id).toBe('text-1');
    const homePage = pages.find((p) => p.id === 'home')!;
    expect(homePage.blocks.map((b) => b.id)).toEqual(['heading-1']);
  });

  it('returns removed: null and the pages untouched when the id is not found', () => {
    const { pages, removed } = removeBlockFromPages(PAGES, 'nope');
    expect(removed).toBeNull();
    expect(pages).toEqual(PAGES);
  });

  it('does not mutate the original pages array', () => {
    const before = JSON.stringify(PAGES);
    removeBlockFromPages(PAGES, 'heading-1');
    expect(JSON.stringify(PAGES)).toBe(before);
  });
});

describe('insertBlockIntoPage', () => {
  const newBlock = { id: 'new-1', type: 'heading', props: { text: 'New' } };

  it('inserts at the top level of the given page, clamped to bounds', () => {
    const updated = insertBlockIntoPage(PAGES, 'home', newBlock, null, 999);
    const homePage = updated.find((p) => p.id === 'home')!;
    expect(homePage.blocks.map((b) => b.id)).toEqual(['heading-1', 'section-1', 'new-1']);
  });

  it('inserts inside a container by id', () => {
    const updated = insertBlockIntoPage(PAGES, 'home', newBlock, 'section-1', 0);
    const homePage = updated.find((p) => p.id === 'home')!;
    const section = homePage.blocks.find((b) => b.id === 'section-1')!;
    expect(section.children?.map((b) => b.id)).toEqual(['new-1', 'text-1']);
  });

  it('leaves other pages untouched', () => {
    const updated = insertBlockIntoPage(PAGES, 'home', newBlock, null, 0);
    const aboutPage = updated.find((p) => p.id === 'about')!;
    expect(aboutPage).toEqual(PAGES[1]);
  });
});
