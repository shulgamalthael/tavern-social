import { describe, expect, it } from 'vitest';
import { formatMoney, fromMinorUnits, toMinorUnits } from './format-money';

/**
 * Currency System (ROADMAP.md §8) — юнит-тесты для чистой денежной
 * арифметики, единственного места в проекте, где юнит-тесты (а не живые
 * E2E-скрипты против backend, см. `vitest.config.ts`) реально уместны:
 * никакой БД/сети, только числа. Покрывает явно требуемый набор валют с
 * разной precision (USD/EUR — 2 знака, PLN — 2 знака с другим разделителем
 * по локали, JPY — 0 знаков).
 *
 * `Intl.NumberFormat('ru-RU', ...)` использует неразрывный пробел (код
 * ` `, не обычный пробел) как разделитель разрядов тысяч — визуально
 * неотличимо при чтении этого файла, но побайтово другой символ, поэтому
 * ниже он собирается явным escape-кодом через `String.fromCharCode`, а не
 * буквальным пробелом в исходнике.
 */
const NBSP = String.fromCharCode(0x00a0);

describe('formatMoney', () => {
  it('formats 2-decimal currencies with the correct symbol and grouping', () => {
    expect(formatMoney(129999, 'USD')).toBe(`1${NBSP}299,99 $`);
    expect(formatMoney(2999, 'EUR')).toBe('29,99 €');
    expect(formatMoney(129999, 'PLN')).toBe(`1${NBSP}299,99 zł`);
  });

  it('formats zero-decimal currencies without a fractional part', () => {
    expect(formatMoney(500, 'JPY')).toBe('500 ¥');
    expect(formatMoney(129999, 'JPY')).toBe(`129${NBSP}999 ¥`);
  });

  it('formats zero amounts and falls back gracefully for an unknown code', () => {
    expect(formatMoney(0, 'USD')).toBe('0,00 $');
    // Неизвестный код -> фолбэк на UAH-метаданные (см. `getCurrencyMetadata`),
    // не исключение — сумма на экране важнее идеальной валидации кода,
    // который в любом случае уже провалидирован на backend при сохранении.
    expect(() => formatMoney(1000, 'ZZZ')).not.toThrow();
  });
});

describe('toMinorUnits', () => {
  it('converts a 2-decimal currency input to minor units', () => {
    expect(toMinorUnits('29.99', 'USD')).toBe(2999);
    expect(toMinorUnits('29,99', 'EUR')).toBe(2999); // запятая как разделитель
    expect(toMinorUnits('899', 'USD')).toBe(89900);
  });

  it('converts a zero-decimal currency input WITHOUT multiplying by 100', () => {
    expect(toMinorUnits('500', 'JPY')).toBe(500);
    expect(toMinorUnits('500.40', 'JPY')).toBe(500); // округление, не *100
  });

  it('rejects empty, negative, and non-numeric input', () => {
    expect(toMinorUnits('', 'USD')).toBeNull();
    expect(toMinorUnits('   ', 'USD')).toBeNull();
    expect(toMinorUnits('-5', 'USD')).toBeNull();
    expect(toMinorUnits('abc', 'USD')).toBeNull();
  });

  it('accepts zero as a valid (free) price', () => {
    expect(toMinorUnits('0', 'USD')).toBe(0);
  });
});

describe('fromMinorUnits', () => {
  it('is the exact inverse of toMinorUnits for 2-decimal currencies', () => {
    expect(fromMinorUnits(2999, 'USD')).toBe('29.99');
    expect(fromMinorUnits(89900, 'EUR')).toBe('899.00');
  });

  it('is the exact inverse of toMinorUnits for zero-decimal currencies', () => {
    expect(fromMinorUnits(500, 'JPY')).toBe('500');
  });

  it('round-trips through toMinorUnits -> fromMinorUnits without drift', () => {
    for (const [input, currency] of [
      ['29.99', 'USD'],
      ['1299.50', 'EUR'],
      ['500', 'JPY'],
    ] as const) {
      const minor = toMinorUnits(input, currency);
      expect(minor).not.toBeNull();
      expect(fromMinorUnits(minor!, currency)).toBe(input);
    }
  });
});
