import { describe, expect, it } from 'vitest';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import { resolveWidgetTemplate, widgetFieldsNeedRefs } from './resolve-widget-template';
import { parseWidgetFields } from './widget-fields';

describe('resolveWidgetTemplate', () => {
  it('substitutes an exact whole-value placeholder, preserving the value type', () => {
    const template: WebsiteBlock[] = [
      { id: 'a', type: 'image', props: { src: '{{photo}}', alt: '', objectFit: 'cover' } },
    ];
    const result = resolveWidgetTemplate(template, { photo: '/uploads/website/real.jpg' });
    expect(result).toEqual([
      { type: 'image', props: { src: '/uploads/website/real.jpg', alt: '', objectFit: 'cover' } },
    ]);
  });

  it('substitutes a partial/embedded placeholder inside a larger string', () => {
    const template: WebsiteBlock[] = [
      { id: 'a', type: 'heading', props: { text: 'Цена: {{price}} грн', level: 'h2' } },
    ];
    const result = resolveWidgetTemplate(template, { price: 490 });
    expect(result[0].props.text).toBe('Цена: 490 грн');
  });

  it('leaves an unknown/undeclared placeholder untouched (no crash, no silent data loss)', () => {
    const template: WebsiteBlock[] = [{ id: 'a', type: 'heading', props: { text: '{{unknown}}' } }];
    const result = resolveWidgetTemplate(template, { headline: 'x' });
    expect(result[0].props.text).toBe('{{unknown}}');
  });

  it('recurses into nested objects (e.g. a linkTarget-shaped prop)', () => {
    const template: WebsiteBlock[] = [
      {
        id: 'a',
        type: 'button',
        props: { label: '{{label}}', url: { type: 'external', url: '{{href}}' } },
      },
    ];
    const result = resolveWidgetTemplate(template, {
      label: 'Купить',
      href: 'https://example.com',
    });
    expect(result[0].props).toEqual({
      label: 'Купить',
      url: { type: 'external', url: 'https://example.com' },
    });
  });

  it('recurses into arrays (e.g. list props)', () => {
    const template: WebsiteBlock[] = [
      { id: 'a', type: 'cards', props: { items: [{ title: '{{title}}' }] } },
    ];
    const result = resolveWidgetTemplate(template, { title: 'Карточка' });
    expect(result[0].props.items).toEqual([{ title: 'Карточка' }]);
  });

  it('leaves a block with no placeholders completely unchanged', () => {
    const template: WebsiteBlock[] = [{ id: 'a', type: 'spacer', props: { height: 'md' } }];
    const result = resolveWidgetTemplate(template, {});
    expect(result).toEqual([{ type: 'spacer', props: { height: 'md' } }]);
  });
});

describe('widgetFieldsNeedRefs', () => {
  it('is false for a widget with no fields, or only primitive-kind fields', () => {
    expect(widgetFieldsNeedRefs([])).toBe(false);
    expect(
      widgetFieldsNeedRefs(
        parseWidgetFields([
          { key: 'a', label: 'A', kind: 'string' },
          { key: 'b', label: 'B', kind: 'number' },
          { key: 'c', label: 'C', kind: 'boolean' },
        ]),
      ),
    ).toBe(false);
  });

  it('is true when any field is mediaAsset or linkTarget', () => {
    expect(
      widgetFieldsNeedRefs(parseWidgetFields([{ key: 'img', label: 'Img', kind: 'mediaAsset' }])),
    ).toBe(true);
    expect(
      widgetFieldsNeedRefs(parseWidgetFields([{ key: 'url', label: 'Url', kind: 'linkTarget' }])),
    ).toBe(true);
  });
});
