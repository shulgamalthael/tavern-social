import { describe, expect, it } from 'vitest';
import type { WebsiteBlock } from '../websites.types';
import { sanitizeRichBlocks } from './sanitize-rich-blocks';

describe('sanitizeRichBlocks', () => {
  it('sanitizes props.text on a top-level "text" block', () => {
    const blocks: WebsiteBlock[] = [
      { id: '1', type: 'text', props: { text: '<script>alert(1)</script>Привет' } },
    ];
    const result = sanitizeRichBlocks(blocks);
    expect(result[0].props.text).toBe('Привет');
  });

  it('sanitizes "richtext" and "quote" the same way', () => {
    const blocks: WebsiteBlock[] = [
      { id: '1', type: 'richtext', props: { text: '<img src=x onerror=alert(1)>ок' } },
      { id: '2', type: 'quote', props: { text: '<script>x</script>цитата', author: 'Имя' } },
    ];
    const result = sanitizeRichBlocks(blocks);
    expect(result[0].props.text).toBe('ок');
    expect(result[1].props.text).toBe('цитата');
    // author не трогается — это не rich-text поле
    expect(result[1].props.author).toBe('Имя');
  });

  it('does not touch props.text on unrelated block types (e.g. heading)', () => {
    const blocks: WebsiteBlock[] = [
      { id: '1', type: 'heading', props: { text: '<script>alert(1)</script>Заголовок' } },
    ];
    const result = sanitizeRichBlocks(blocks);
    // heading использует простой EditableText (без Tiptap) — HTML тут не
    // ожидается вообще, но эта функция намеренно не трогает его: React сам
    // экранирует текст при обычном рендере, если что-то похожее на тег
    // всё же туда попадёт.
    expect(result[0].props.text).toBe('<script>alert(1)</script>Заголовок');
  });

  it('recurses into children (nested inside section/columns/column)', () => {
    const blocks: WebsiteBlock[] = [
      {
        id: 'section-1',
        type: 'section',
        props: {},
        children: [
          {
            id: 'columns-1',
            type: 'columns',
            props: {},
            children: [
              {
                id: 'col-1',
                type: 'column',
                props: {},
                children: [{ id: 'text-1', type: 'text', props: { text: '<script>x</script>ok' } }],
              },
            ],
          },
        ],
      },
    ];
    const result = sanitizeRichBlocks(blocks);
    const nested = result[0].children![0].children![0].children![0];
    expect(nested.props.text).toBe('ok');
  });

  it('leaves a block with no props.text untouched (e.g. structural section)', () => {
    const blocks: WebsiteBlock[] = [{ id: '1', type: 'section', props: {} }];
    const result = sanitizeRichBlocks(blocks);
    expect(result[0].props).toEqual({});
  });

  it('does not mutate the original input array/objects', () => {
    const blocks: WebsiteBlock[] = [
      { id: '1', type: 'text', props: { text: '<script>alert(1)</script>x' } },
    ];
    const before = JSON.stringify(blocks);
    sanitizeRichBlocks(blocks);
    expect(JSON.stringify(blocks)).toBe(before);
  });
});
