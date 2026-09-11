import { describe, expect, it } from 'vitest';
import { buildValidatedWidgetValues, parseWidgetFields } from './widget-fields';

const FULL_REFS = {
  pageIds: new Set<string>(),
  productIds: new Set<string>(),
  serviceIds: new Set<string>(['svc-1']),
  mediaAssetUrls: new Set<string>(['/uploads/website/photo.jpg']),
};

describe('parseWidgetFields', () => {
  it('returns an empty array for undefined/null — full backward compatibility', () => {
    expect(parseWidgetFields(undefined)).toEqual([]);
    expect(parseWidgetFields(null)).toEqual([]);
  });

  it('rejects a non-array', () => {
    expect(() => parseWidgetFields('not an array')).toThrow('должен быть массивом');
  });

  it('rejects more than 20 fields', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({
      key: `field${i}`,
      label: `Field ${i}`,
      kind: 'string',
    }));
    expect(() => parseWidgetFields(many)).toThrow('не может содержать больше 20');
  });

  it('parses a valid string field', () => {
    const result = parseWidgetFields([{ key: 'headline', label: 'Заголовок', kind: 'string' }]);
    expect(result).toEqual([{ key: 'headline', label: 'Заголовок', kind: 'string' }]);
  });

  it('rejects an invalid key (not a safe identifier)', () => {
    expect(() => parseWidgetFields([{ key: '123bad', label: 'X', kind: 'string' }])).toThrow(
      'key должен быть строкой',
    );
    expect(() => parseWidgetFields([{ key: 'has space', label: 'X', kind: 'string' }])).toThrow(
      'key должен быть строкой',
    );
  });

  it('rejects duplicate keys', () => {
    expect(() =>
      parseWidgetFields([
        { key: 'x', label: 'A', kind: 'string' },
        { key: 'x', label: 'B', kind: 'number' },
      ]),
    ).toThrow('повторяется');
  });

  it('rejects an unknown kind', () => {
    expect(() => parseWidgetFields([{ key: 'x', label: 'X', kind: 'list' }])).toThrow(
      'kind должен быть одним из',
    );
    expect(() => parseWidgetFields([{ key: 'x', label: 'X', kind: 'dataSource' }])).toThrow(
      'kind должен быть одним из',
    );
  });

  it('requires values for kind: enum', () => {
    expect(() => parseWidgetFields([{ key: 'x', label: 'X', kind: 'enum' }])).toThrow(
      'values обязателен',
    );
    expect(() => parseWidgetFields([{ key: 'x', label: 'X', kind: 'enum', values: [] }])).toThrow(
      'values обязателен',
    );
  });

  it('accepts a well-formed enum field', () => {
    const result = parseWidgetFields([
      { key: 'variant', label: 'Вариант', kind: 'enum', values: ['a', 'b'] },
    ]);
    expect(result[0]).toEqual({
      key: 'variant',
      label: 'Вариант',
      kind: 'enum',
      values: ['a', 'b'],
    });
  });

  it('accepts number field with min/max', () => {
    const result = parseWidgetFields([{ key: 'n', label: 'N', kind: 'number', min: 1, max: 10 }]);
    expect(result[0]).toEqual({ key: 'n', label: 'N', kind: 'number', min: 1, max: 10 });
  });

  it('accepts mediaAsset/linkTarget fields with no extra params', () => {
    const result = parseWidgetFields([
      { key: 'img', label: 'Фото', kind: 'mediaAsset' },
      { key: 'url', label: 'Ссылка', kind: 'linkTarget' },
    ]);
    expect(result).toEqual([
      { key: 'img', label: 'Фото', kind: 'mediaAsset' },
      { key: 'url', label: 'Ссылка', kind: 'linkTarget' },
    ]);
  });
});

describe('buildValidatedWidgetValues', () => {
  const fields = parseWidgetFields([
    { key: 'headline', label: 'Заголовок', kind: 'string', maxLength: 10 },
    { key: 'count', label: 'Число', kind: 'number', min: 0, max: 100 },
  ]);

  it('rejects unknown keys', () => {
    expect(() =>
      buildValidatedWidgetValues(fields, { headline: 'x', count: 1, extra: 'y' }),
    ).toThrow('Неизвестные параметры');
  });

  it('requires every declared field', () => {
    expect(() => buildValidatedWidgetValues(fields, { headline: 'x' })).toThrow(
      'Не хватает значения параметра',
    );
  });

  it('validates via the same rules as an ordinary block prop (e.g. maxLength)', () => {
    expect(() =>
      buildValidatedWidgetValues(fields, { headline: 'this is way too long', count: 1 }),
    ).toThrow('не может быть длиннее');
  });

  it('accepts valid values', () => {
    const result = buildValidatedWidgetValues(fields, { headline: 'Привет', count: 42 });
    expect(result).toEqual({ headline: 'Привет', count: 42 });
  });

  it('validates mediaAsset against real refs — rejects an unknown URL', () => {
    const mediaFields = parseWidgetFields([{ key: 'img', label: 'Фото', kind: 'mediaAsset' }]);
    expect(() =>
      buildValidatedWidgetValues(mediaFields, { img: '/uploads/website/fake.jpg' }, FULL_REFS),
    ).toThrow('уже загруженный файл');
    const result = buildValidatedWidgetValues(
      mediaFields,
      { img: '/uploads/website/photo.jpg' },
      FULL_REFS,
    );
    expect(result).toEqual({ img: '/uploads/website/photo.jpg' });
  });
});
