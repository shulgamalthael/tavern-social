/**
 * Единый источник истины о поддерживаемых валютах — Currency System (см.
 * ROADMAP.md §8, Phase Currency System). Продублировано с backend
 * (`backend/src/modules/currencies/currencies.ts`) намеренно — два разных
 * TS-проекта без общего пакета типов, тот же принцип, что и у остальных
 * общих констант в проекте (см. AGENTS.md backend про дублирование DTO).
 * Меняете список — правьте оба места.
 *
 * Business выбирает ОДНУ основную валюту (`Business.currency`); Product/
 * Service не имеют собственного поля валюты вообще — их цена всегда
 * отображается в валюте бизнеса (см. backend-комментарий модели `Product`).
 * Order/Appointment снимают валюту снэпшотом на момент создания и не
 * меняются, даже если бизнес позже сменит основную валюту.
 *
 * Список НЕ исчерпывает 135+ валют, которые в принципе принимает Stripe API
 * — курируемый набор: минимум одна валюта с нулевым `minorUnit` (`JPY`/
 * `KRW`, чтобы код зон, зависящих от precision, реально проверялся не
 * только на 2-decimal случае) и `RUB` как исторический дефолт проекта
 * (Stripe документирует минимальную сумму платежа в RUB, значит код
 * API-совместим). Расширение — одна новая строка, не архитектурное
 * изменение.
 */
export interface CurrencyMetadata {
  code: string;
  name: string;
  symbol: string;
  minorUnit: 0 | 2;
}

export const SUPPORTED_CURRENCIES: CurrencyMetadata[] = [
  { code: 'RUB', name: 'Российский рубль', symbol: '₽', minorUnit: 2 },
  { code: 'USD', name: 'Доллар США', symbol: '$', minorUnit: 2 },
  { code: 'EUR', name: 'Евро', symbol: '€', minorUnit: 2 },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£', minorUnit: 2 },
  { code: 'PLN', name: 'Польский злотый', symbol: 'zł', minorUnit: 2 },
  { code: 'UAH', name: 'Украинская гривна', symbol: '₴', minorUnit: 2 },
  { code: 'CAD', name: 'Канадский доллар', symbol: 'CA$', minorUnit: 2 },
  { code: 'AUD', name: 'Австралийский доллар', symbol: 'A$', minorUnit: 2 },
  { code: 'CHF', name: 'Швейцарский франк', symbol: 'CHF', minorUnit: 2 },
  { code: 'SEK', name: 'Шведская крона', symbol: 'kr', minorUnit: 2 },
  { code: 'NOK', name: 'Норвежская крона', symbol: 'kr', minorUnit: 2 },
  { code: 'CZK', name: 'Чешская крона', symbol: 'Kč', minorUnit: 2 },
  { code: 'JPY', name: 'Японская иена', symbol: '¥', minorUnit: 0 },
  { code: 'KRW', name: 'Южнокорейская вона', symbol: '₩', minorUnit: 0 },
];

const CURRENCY_BY_CODE = new Map(SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency]));

/** Для `<select>` в форме создания бизнеса и в настройках валюты (см. §6:
 * "US Dollar (USD) — $", не просто голый код) — но с русским отображаемым
 * именем, раз весь интерфейс проекта на русском. */
export const CURRENCY_OPTIONS: { value: string; label: string }[] = SUPPORTED_CURRENCIES.map(
  (currency) => ({
    value: currency.code,
    label: `${currency.name} (${currency.code}) — ${currency.symbol}`,
  }),
);

export function isSupportedCurrencyCode(code: string): boolean {
  return CURRENCY_BY_CODE.has(code);
}

/** Фолбэк на `RUB`-метаданные при неизвестном коде — например, пока
 * `Business`/`Product` ещё грузится и currency временно `undefined`, или
 * если когда-нибудь встретится код, изъятый из `SUPPORTED_CURRENCIES`
 * позже. `formatMoney`/`toMinorUnits` не должны падать на этом — сумма
 * денег на экране важнее идеальной валидации кода валюты, который в любом
 * случае уже провалидирован на backend при сохранении. */
export function getCurrencyMetadata(code: string): CurrencyMetadata {
  return CURRENCY_BY_CODE.get(code) ?? CURRENCY_BY_CODE.get('RUB')!;
}

export const DEFAULT_BUSINESS_CURRENCY = 'RUB';
