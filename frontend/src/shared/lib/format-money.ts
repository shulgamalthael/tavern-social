import { getCurrencyMetadata } from '../config/currencies';

/**
 * Единственное место в проекте, которое форматирует деньги для показа
 * пользователю — см. ROADMAP.md §8, Phase Currency System. Раньше это была
 * отдельная, наивная реализация в `entities/product/model/format-price.ts`
 * (`priceCents / 100` безусловно для любой валюты — реальный баг для
 * нулевых minor unit, например `JPY`); теперь один `formatMoney`,
 * применяемый одинаково в `ProductCard`/`ServiceCard`/`CartWidget`/
 * `OrdersSection`/`AppointmentsSection`/формах Dashboard.
 *
 * `Intl.NumberFormat` делает только числовую часть (`style: 'decimal'`, не
 * `'currency'`) — сколько знаков после запятой, разделитель разрядов,
 * десятичный разделитель. Символ валюты добавляется вручную ИЗ
 * `CurrencyMetadata.symbol`, не из `Intl`: проверено на практике (см.
 * `format-money.test.ts`) — `Intl.NumberFormat('ru-RU', {style: 'currency',
 * currency: 'PLN', currencyDisplay: 'symbol'})` тихо возвращает `"PLN"`
 * вместо `"zł"`, потому что у ru-RU locale в CLDR просто нет отображаемого
 * символа для PLN — `Intl` в этом случае молча откатывается на ISO-код.
 * Полагаться на `Intl` для ВЫБОРА символа означало бы показывать разный,
 * непредсказуемый символ в зависимости от того, знает ли конкретная locale
 * конкретную валюту — не то же самое для КАЖДОЙ валюты из `SUPPORTED_
 * CURRENCIES`, которое видит выбор в `CURRENCY_OPTIONS`/ProductFormModal.
 * Локаль форматирования числа фиксирована как `ru-RU` для ВСЕХ валют — весь
 * интерфейс проекта на русском, а не локаль конкретной валюты (иначе JPY
 * показывался бы по японским, PLN — по польским конвенциям разделителей
 * внутри одного русскоязычного интерфейса, что выглядело бы непоследовательно).
 */
export function formatMoney(amountMinor: number, currencyCode: string): string {
  const currency = getCurrencyMetadata(currencyCode);
  const majorAmount = amountMinor / 10 ** currency.minorUnit;
  const formattedAmount = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: currency.minorUnit,
    maximumFractionDigits: currency.minorUnit,
  }).format(majorAmount);
  return `${formattedAmount} ${currency.symbol}`;
}

/** Строка из поля ввода («29.99», «29,99», «5») → минимальные единицы
 * валюты (`2999`, `2999`, `500`) — учитывает `minorUnit` ИМЕННО этой
 * валюты, не безусловное `* 100` (§9/§56: запрещено домножать на 100 для
 * любой валюты без проверки minor unit — для `JPY`/`KRW` результат должен
 * остаться цельным числом без домножения). `null` — ввод не парсится как
 * неотрицательное число, отличать от «пусто» на уровне вызывающей формы
 * (см. `parseStock` в `ProductFormModal.tsx` — тот же принцип различения
 * «пусто» и «невалидно», не путать `NaN`, который JSON.stringify тихо
 * превращает в `null`, с осмысленным пользовательским вводом). */
export function toMinorUnits(input: string, currencyCode: string): number | null {
  const normalized = input.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const currency = getCurrencyMetadata(currencyCode);
  return Math.round(parsed * 10 ** currency.minorUnit);
}

/** Обратная операция — минимальные единицы → строка для предзаполнения
 * поля редактирования («2999» → «29.99», «500» JPY → «500», без дробной
 * части). Не `formatMoney` (тот — для ПОКАЗА с символом валюты и
 * разделителями тысяч, непригоден для текстового поля ввода, которое
 * пользователь должен суметь отредактировать посимвольно). */
export function fromMinorUnits(amountMinor: number, currencyCode: string): string {
  const currency = getCurrencyMetadata(currencyCode);
  return (amountMinor / 10 ** currency.minorUnit).toFixed(currency.minorUnit);
}
