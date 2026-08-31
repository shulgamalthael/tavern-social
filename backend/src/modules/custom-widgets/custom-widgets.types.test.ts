import { describe, expect, it } from 'vitest';
import { parseWidgetSchema } from './custom-widgets.types';

describe('parseWidgetSchema', () => {
  it('rejects a non-array or empty schema', () => {
    expect(() => parseWidgetSchema(null)).toThrow('непустым массивом');
    expect(() => parseWidgetSchema([])).toThrow('непустым массивом');
    expect(() => parseWidgetSchema('heading')).toThrow('непустым массивом');
  });

  it('builds a valid block array with fresh ids, reusing add_block validation', () => {
    const result = parseWidgetSchema([
      { blockType: 'heading', props: { text: 'Привет' } },
      { blockType: 'spacer' },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('heading');
    expect(result[0].props).toEqual({ text: 'Привет', level: 'h2', size: 'md', color: 'default' });
    expect(result[1].type).toBe('spacer');
    expect(result[1].props).toEqual({ height: 'md' });
    // Свежий id на каждый блок, не взятый от вызывающего.
    expect(result[0].id).not.toBe(result[1].id);
    expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores any client-supplied id — always assigns a fresh one', () => {
    const result = parseWidgetSchema([
      { blockType: 'text', props: {}, id: 'attacker-supplied' } as never,
    ]);
    expect(result[0].id).not.toBe('attacker-supplied');
  });

  it('rejects a blockType outside the curated allowlist', () => {
    expect(() => parseWidgetSchema([{ blockType: 'gallery' }])).toThrow(
      'blockType должен быть одним из',
    );
    expect(() => parseWidgetSchema([{ blockType: 'productgrid' }])).toThrow(
      'blockType должен быть одним из',
    );
  });

  it('rejects an unknown prop field, same error shape as add_block', () => {
    expect(() =>
      parseWidgetSchema([
        { blockType: 'heading', props: { text: 'Hi', href: 'https://evil.example' } },
      ]),
    ).toThrow('Неизвестные поля');
  });

  it('rejects a malformed item (not an object)', () => {
    expect(() => parseWidgetSchema(['heading'])).toThrow('должен быть объектом');
  });
});
