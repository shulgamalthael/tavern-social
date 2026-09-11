import { describe, expect, it } from 'vitest';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import { countBlocksOfType } from './count-ad-slot-blocks';

function block(type: string, children?: WebsiteBlock[]): WebsiteBlock {
  return { id: `${type}-${Math.random()}`, type, props: {}, children };
}

describe('countBlocksOfType', () => {
  it('returns 0 for pages with no matching blocks', () => {
    const pages = [[block('heading'), block('text')]];
    expect(countBlocksOfType(pages, 'adslot')).toBe(0);
  });

  it('counts top-level matches across multiple pages', () => {
    const pages = [
      [block('adslot'), block('text')],
      [block('adslot'), block('adslot')],
    ];
    expect(countBlocksOfType(pages, 'adslot')).toBe(3);
  });

  it('counts matches nested inside container children', () => {
    const pages = [[block('section', [block('adslot'), block('column', [block('adslot')])])]];
    expect(countBlocksOfType(pages, 'adslot')).toBe(2);
  });

  it('treats null/undefined page content as an empty page', () => {
    expect(countBlocksOfType([null, undefined], 'adslot')).toBe(0);
  });
});
