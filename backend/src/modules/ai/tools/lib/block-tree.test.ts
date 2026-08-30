import { describe, expect, it } from 'vitest';
import type { WebsitePage } from '@/modules/websites/websites.types';
import { findBlockInPages, replaceBlockInPages } from './block-tree';

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
