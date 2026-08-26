/**
 * Единый источник истины о поддерживаемых валютах — Currency System
 * (см. ROADMAP.md §8, Phase Currency System). Business выбирает ОДНУ
 * основную валюту (см. `Business.currency` в schema.prisma); эта валюта —
 * единственный источник для Product/Service (у них больше нет собственного
 * поля `currency` вообще, см. комментарий модели `Product`) и снимается
 * снэпшотом в Order/Appointment на момент создания (см. их комментарии).
 *
 * Список — НЕ исчерпывающий список из 135+ валют, которые в принципе
 * принимает Stripe API (https://docs.stripe.com/currencies) — намеренно
 * курируемый набор реальных, часто используемых валют, среди которых есть
 * минимум один пример валюты с нулевым minor unit (`JPY`, `KRW`) и минимум
 * одна валюта с наибольшей практической значимостью для проекта (`RUB`,
 * исторический дефолт — Stripe документирует минимальную сумму платежа в
 * RUB, `0.50 RUB`, то есть код валюты API-совместим). Расширение списка —
 * это одна новая строка здесь, не архитектурное изменение.
 *
 * `minorUnit` — количество знаков после запятой в МЕНЬШЕЙ единице валюты
 * (ISO 4217), ровно то же значение, которого требует Stripe API для поля
 * `amount` (https://docs.stripe.com/currencies#zero-decimal): для валюты с
 * `minorUnit: 0` (`JPY`) `amount: 500` значит «500 йен», для `minorUnit: 2`
 * (`USD`) `amount: 500` значит «5.00 долларов». `priceCents`/`totalCents`
 * в проекте — несмотря на название, для валют с `minorUnit !== 2` это НЕ
 * буквально центы, а именно «минимальные единицы валюты», подставляемые в
 * Stripe `amount` без какого-либо домножения — конвертация «человек ввёл
 * 29.99 → 2999» происходит ОДИН раз, на границе UI (см. `toMinorUnits` во
 * frontend `shared/lib/format-money.ts`), с учётом `minorUnit` именно этой
 * валюты, а не universally `* 100`.
 */
export interface CurrencyMetadata {
  /** ISO 4217, заглавными буквами — Stripe принимает код валюты в нижнем
   * регистре в API-запросах (см. `StripeAdapter.createPaymentIntent`,
   * `currency.toLowerCase()`), но каноническая форма везде в проекте —
   * заглавные буквы, как в `Business.currency`/значениях этого списка. */
  code: string;
  /** Отображаемое имя на русском — язык интерфейса проекта. */
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

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code);

const CURRENCY_BY_CODE = new Map(SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency]));

export function isSupportedCurrencyCode(code: string): boolean {
  return CURRENCY_BY_CODE.has(code);
}

/** Бросает, а не возвращает `undefined` — вызывающий код (сервисы, `Stripe
 * Adapter`) уже прошёл валидацию `isSupportedCurrencyCode`/`@IsIn` раньше,
 * поэтому неизвестный код здесь — программная ошибка, а не пользовательский
 * ввод, который нужно обрабатывать мягко. */
export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const currency = CURRENCY_BY_CODE.get(code);
  if (!currency) throw new Error(`Неизвестный код валюты: ${code}`);
  return currency;
}

export const DEFAULT_BUSINESS_CURRENCY = 'RUB';
