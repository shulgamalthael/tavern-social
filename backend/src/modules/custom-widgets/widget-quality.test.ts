import { describe, expect, it } from 'vitest';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import { assessWidgetQuality } from './widget-quality.lib';

function block(type: string, props: Record<string, unknown>): WebsiteBlock {
  return { id: 'x', type: type, props };
}

function styledBlock(
  type: string,
  props: Record<string, unknown>,
  style: Record<string, unknown>,
): WebsiteBlock {
  return { id: 'x', type: type, props, style };
}

describe('assessWidgetQuality', () => {
  it('rejects a widget made only of trivial/structural blocks', () => {
    const result = assessWidgetQuality([
      block('spacer', { height: 'md' }),
      block('divider', { style: 'solid' }),
    ]);
    expect(result.passes).toBe(false);
    expect(result.reason).toMatch(/структурных блоков/);
  });

  it('rejects a widget whose every block is left at its schema defaults', () => {
    const result = assessWidgetQuality([
      block('heading', { text: 'Заголовок раздела', level: 'h2', size: 'md', color: 'default' }),
    ]);
    expect(result.passes).toBe(false);
    expect(result.reason).toMatch(/умолчанию/);
  });

  it('passes a widget with real, non-default, non-trivial content expressed as a parameter', () => {
    const result = assessWidgetQuality(
      [block('heading', { text: '{{headline}}', level: 'h2', size: 'md', color: 'default' })],
      new Set(['headline']),
    );
    expect(result.passes).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('passes when at least one block is substantive (non-content field) even alongside trivial ones', () => {
    const result = assessWidgetQuality([
      block('spacer', { height: 'md' }),
      block('heading', { text: 'Заголовок раздела', level: 'h2', size: 'lg', color: 'default' }),
    ]);
    expect(result.passes).toBe(true);
  });

  describe('AI_PLATFORM_ROADMAP.md §78 — a styled-but-default-props widget is not "nothing to share"', () => {
    it('passes an all-default-props widget that carries real, non-empty style', () => {
      const result = assessWidgetQuality([
        styledBlock(
          'heading',
          { text: 'Заголовок раздела', level: 'h2', size: 'md', color: 'default' },
          { background: 'gradient', gradientFrom: '#111111', gradientTo: '#222222' },
        ),
      ]);
      expect(result.passes).toBe(true);
    });

    it('still rejects an all-default-props widget with an empty style object', () => {
      const result = assessWidgetQuality([
        styledBlock(
          'heading',
          { text: 'Заголовок раздела', level: 'h2', size: 'md', color: 'default' },
          {},
        ),
      ]);
      expect(result.passes).toBe(false);
      expect(result.reason).toMatch(/умолчанию/);
    });
  });

  describe('AI_PLATFORM_ROADMAP.md §76 — links + text must be parametrized for catalog admission', () => {
    it('rejects a hardcoded (non-default, non-parametrized) text prop', () => {
      const result = assessWidgetQuality([
        block('heading', {
          text: 'Скидка выходного дня',
          level: 'h2',
          size: 'md',
          color: 'default',
        }),
      ]);
      expect(result.passes).toBe(false);
      expect(result.reason).toMatch(/готовый текст\/ссылку вместо параметра/);
    });

    it('rejects a hardcoded (non-default, non-parametrized) linkTarget prop', () => {
      const result = assessWidgetQuality([
        block('button', {
          label: 'Узнать больше',
          url: { type: 'external', url: 'https://example.com' },
          variant: 'solid',
          size: 'md',
          target: '_self',
        }),
      ]);
      expect(result.passes).toBe(false);
      expect(result.reason).toMatch(/поле "url"/);
    });

    it('accepts a linkTarget prop left at its untouched default (empty link)', () => {
      const result = assessWidgetQuality(
        [
          block('button', {
            label: '{{ctaLabel}}',
            url: { type: 'external', url: '' },
            variant: 'solid',
            size: 'md',
            target: '_self',
          }),
        ],
        new Set(['ctaLabel']),
      );
      expect(result.passes).toBe(true);
    });

    it('accepts a whole-value placeholder for a linkTarget prop, tied to a declared field', () => {
      const result = assessWidgetQuality(
        [
          block('button', {
            label: '{{ctaLabel}}',
            url: '{{ctaUrl}}',
            variant: 'solid',
            size: 'md',
            target: '_self',
          }),
        ],
        new Set(['ctaLabel', 'ctaUrl']),
      );
      expect(result.passes).toBe(true);
    });

    it('rejects a partial in-string placeholder for catalog purposes — must be the whole value', () => {
      const result = assessWidgetQuality(
        [
          block('heading', {
            text: 'Цена: {{price}} грн',
            level: 'h2',
            size: 'md',
            color: 'default',
          }),
        ],
        new Set(['price']),
      );
      expect(result.passes).toBe(false);
      expect(result.reason).toMatch(/поле "text"/);
    });

    it('does not flag a placeholder for an UNdeclared key — falls through as unparametrized content', () => {
      const result = assessWidgetQuality(
        [block('heading', { text: '{{headline}}', level: 'h2', size: 'md', color: 'default' })],
        new Set(['other']),
      );
      expect(result.passes).toBe(false);
    });

    it('ignores non-content field kinds (enum/number/boolean) entirely — only string/linkTarget are checked', () => {
      const result = assessWidgetQuality([
        block('heading', { text: 'Заголовок раздела', level: 'h1', size: 'xl', color: 'primary' }),
      ]);
      expect(result.passes).toBe(true);
    });
  });

  it('produces the same hash regardless of prop key order', () => {
    const a = assessWidgetQuality([block('heading', { text: 'X', level: 'h2' })]);
    const b = assessWidgetQuality([block('heading', { level: 'h2', text: 'X' })]);
    expect(a.schemaHash).toBe(b.schemaHash);
  });

  it('produces a different hash for genuinely different content', () => {
    const a = assessWidgetQuality([block('heading', { text: 'X', level: 'h2' })]);
    const b = assessWidgetQuality([block('heading', { text: 'Y', level: 'h2' })]);
    expect(a.schemaHash).not.toBe(b.schemaHash);
  });
});
