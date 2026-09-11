import { Module } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';

/**
 * `currencies.ts` (список поддерживаемых валют/`CurrencyMetadata`) — не
 * NestJS-модуль, чистые функции без состояния, импортируются напрямую
 * везде, где нужны. Этот модуль — только для того, что реально нуждается в
 * DI (Redis-кэш курсов), т. е. `ExchangeRatesService`.
 */
@Module({
  providers: [ExchangeRatesService],
  exports: [ExchangeRatesService],
})
export class CurrenciesModule {}
