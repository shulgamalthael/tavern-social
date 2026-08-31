import { describe, expect, it } from 'vitest';
import {
  appendField,
  parseEntityFields,
  parseSingleField,
  validateRecordData,
} from './custom-entity-schema.lib';

describe('parseSingleField', () => {
  it('accepts a valid field and defaults required to false', () => {
    expect(
      parseSingleField({ key: 'customerName', label: 'Имя клиента', type: 'string' }, []),
    ).toEqual({
      key: 'customerName',
      label: 'Имя клиента',
      type: 'string',
      required: false,
    });
  });

  it('rejects a key that does not start with a lowercase letter', () => {
    expect(() => parseSingleField({ key: '1abc', label: 'x', type: 'string' }, [])).toThrow(
      /key обязателен/,
    );
  });

  it('rejects a duplicate key against existingKeys', () => {
    expect(() =>
      parseSingleField({ key: 'age', label: 'Возраст', type: 'number' }, ['age']),
    ).toThrow(/уже существует/);
  });

  it('rejects an unknown type', () => {
    expect(() => parseSingleField({ key: 'age', label: 'Возраст', type: 'integer' }, [])).toThrow(
      /type должен быть/,
    );
  });
});

describe('parseEntityFields', () => {
  it('rejects an empty array', () => {
    expect(() => parseEntityFields([])).toThrow(/непустым массивом/);
  });

  it('rejects duplicate keys within the same batch', () => {
    expect(() =>
      parseEntityFields([
        { key: 'name', label: 'Имя', type: 'string' },
        { key: 'name', label: 'Имя ещё раз', type: 'string' },
      ]),
    ).toThrow(/уже существует/);
  });

  it('parses a valid multi-field batch', () => {
    const fields = parseEntityFields([
      { key: 'name', label: 'Имя', type: 'string', required: true },
      { key: 'age', label: 'Возраст', type: 'number' },
    ]);
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ key: 'name', label: 'Имя', type: 'string', required: true });
  });
});

describe('appendField', () => {
  const existing = [{ key: 'name', label: 'Имя', type: 'string' as const, required: false }];

  it('appends a new field to the existing list', () => {
    const result = appendField(existing, { key: 'age', label: 'Возраст', type: 'number' });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existing[0]);
    expect(result[1].key).toBe('age');
  });

  it('rejects a key that collides with an existing field', () => {
    expect(() => appendField(existing, { key: 'name', label: 'Имя 2', type: 'string' })).toThrow(
      /уже существует/,
    );
  });
});

describe('validateRecordData', () => {
  const fields = [
    { key: 'name', label: 'Имя', type: 'string' as const, required: true },
    { key: 'age', label: 'Возраст', type: 'number' as const, required: false },
    { key: 'active', label: 'Активен', type: 'boolean' as const, required: false },
    { key: 'birthday', label: 'День рождения', type: 'date' as const, required: false },
  ];

  it('accepts a fully valid record', () => {
    expect(
      validateRecordData(fields, {
        name: 'Аня',
        age: 30,
        active: true,
        birthday: '2000-01-01',
      }),
    ).toEqual({ name: 'Аня', age: 30, active: true, birthday: '2000-01-01' });
  });

  it('omits absent optional fields rather than inventing a default', () => {
    expect(validateRecordData(fields, { name: 'Аня' })).toEqual({ name: 'Аня' });
  });

  it('throws when a required field is missing', () => {
    expect(() => validateRecordData(fields, { age: 30 })).toThrow(/"name" обязательно/);
  });

  it('rejects a field outside the entity schema instead of silently dropping it', () => {
    expect(() => validateRecordData(fields, { name: 'Аня', unknownField: 1 })).toThrow(
      /Неизвестные поля: unknownField/,
    );
  });

  it('rejects a number field sent as a string (no implicit coercion)', () => {
    expect(() => validateRecordData(fields, { name: 'Аня', age: '30' })).toThrow(
      /"age" должно быть числом/,
    );
  });

  it('rejects an invalid date string', () => {
    expect(() => validateRecordData(fields, { name: 'Аня', birthday: 'not-a-date' })).toThrow(
      /"birthday" должно быть датой/,
    );
  });
});
