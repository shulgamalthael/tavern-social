import { describe, expect, it } from 'vitest';
import { parseWidgetSchema } from './custom-widgets.types';

describe('parseWidgetSchema', () => {
  it('rejects a non-array or empty schema', () => {
    expect(() => parseWidgetSchema(null)).toThrow('непустым массивом');
    expect(() => parseWidgetSchema([])).toThrow('непустым массивом');
    expect(() => parseWidgetSchema('heading')).toThrow('непустым массивом');
  });

  it('rejects a schema with more than the allowed number of blocks (AI_PLATFORM_ROADMAP.md §75)', () => {
    const tooMany = Array.from({ length: 31 }, () => ({ blockType: 'spacer' }));
    expect(() => parseWidgetSchema(tooMany)).toThrow('не может содержать больше');
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
    expect(() => parseWidgetSchema([{ blockType: 'notarealblocktype' }])).toThrow(
      'blockType должен быть одним из',
    );
    expect(() => parseWidgetSchema([{ blockType: '' }])).toThrow('blockType должен быть одним из');
  });

  it('accepts previously-unsupported types now that the allowlist covers the full registry', () => {
    // `gallery`/`productgrid` теперь входят в `ALLOWED_BLOCK_TYPES`
    // (`add-block-schemas.ts`) — виджет с ними больше не отклоняется на
    // уровне типа, `mediaAsset`/`dataSource`-поля валидируются как обычно.
    const result = parseWidgetSchema([{ blockType: 'productgrid' }]);
    expect(result[0].type).toBe('productgrid');
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

  it('accepts web3wallet — a live-data block with no refs-requiring fields', () => {
    const result = parseWidgetSchema([{ blockType: 'web3wallet', props: { nftLimit: 10 } }]);
    expect(result[0].type).toBe('web3wallet');
    expect(result[0].props).toEqual({
      eyebrow: 'WEB3',
      heading: 'Наш кошелёк',
      description: '',
      nftLimit: 10,
    });
  });

  describe('§62.1 — widget kind placeholders (declaredFieldKeys)', () => {
    it('without declaredFieldKeys (default), a placeholder-looking value in a non-string field is rejected exactly as before — full backward compatibility', () => {
      expect(() =>
        parseWidgetSchema([{ blockType: 'spacer', props: { height: '{{size}}' } }]),
      ).toThrow(/должно быть одним из/);
    });

    it('accepts a whole-value placeholder for a declared field, in a non-string field (enum)', () => {
      const result = parseWidgetSchema(
        [{ blockType: 'spacer', props: { height: '{{size}}' } }],
        new Set(['size']),
      );
      expect(result[0].props.height).toBe('{{size}}');
    });

    it('does not accept a placeholder for an UNdeclared key — falls through to normal validation and fails', () => {
      expect(() =>
        parseWidgetSchema(
          [{ blockType: 'spacer', props: { height: '{{other}}' } }],
          new Set(['size']),
        ),
      ).toThrow(/должно быть одним из/);
    });

    it('a partial/embedded placeholder inside a string-kind field needs no special-casing — already a valid string', () => {
      const result = parseWidgetSchema(
        [{ blockType: 'heading', props: { text: 'Цена: {{price}}' } }],
        new Set(['price']),
      );
      expect(result[0].props.text).toBe('Цена: {{price}}');
    });

    it('still merges in defaults for props not touched by a placeholder', () => {
      const result = parseWidgetSchema(
        [{ blockType: 'heading', props: { text: '{{headline}}' } }],
        new Set(['headline']),
      );
      expect(result[0].props).toEqual({
        text: '{{headline}}',
        level: 'h2',
        size: 'md',
        color: 'default',
      });
    });
  });

  describe('§78 — style is preserved, not silently dropped', () => {
    it('is absent on the resulting block when not passed', () => {
      const result = parseWidgetSchema([{ blockType: 'spacer' }]);
      expect(result[0].style).toBeUndefined();
    });

    it('validates and stores a passed style', () => {
      const result = parseWidgetSchema([
        {
          blockType: 'heading',
          props: { text: 'Скидка недели' },
          style: { background: 'surface' },
        },
      ]);
      expect(result[0].style).toEqual({ background: 'surface' });
    });

    it('rejects an unknown style field, same error shape as set_style', () => {
      expect(() =>
        parseWidgetSchema([{ blockType: 'spacer', style: { notARealField: 'x' } }]),
      ).toThrow(/schema\[0\]\.style.*Неизвестные поля стиля/);
    });

    it('rejects an invalid value for a known style field', () => {
      expect(() =>
        parseWidgetSchema([{ blockType: 'spacer', style: { background: 'not-a-real-value' } }]),
      ).toThrow(/schema\[0\]\.style/);
    });

    it('accepts the "advanced" CSS bucket the same way set_style does', () => {
      const result = parseWidgetSchema([
        { blockType: 'spacer', style: { advanced: { transform: 'rotate(-4deg)' } } },
      ]);
      expect(result[0].style).toEqual({ advanced: { transform: 'rotate(-4deg)' } });
    });

    it('rejects an "advanced" value containing url(...)', () => {
      expect(() =>
        parseWidgetSchema([
          { blockType: 'spacer', style: { advanced: { filter: 'url(https://evil.example)' } } },
        ]),
      ).toThrow(/schema\[0\]\.style/);
    });
  });
});
