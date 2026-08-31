import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { StripeSubscriptionProvider } from './stripe-subscription-provider';

/** Гарантирует существование Stripe Product/Price для платных тиров при
 * старте backend — см. `StripeSubscriptionAdapter.ensurePlansBootstrapped`
 * для самой (идемпотентной) логики. Молча пропускает, если Stripe не
 * настроен — тот же graceful-degradation принцип, что у остального Stripe-
 * кода в проекте. */
@Injectable()
export class StripePlanBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StripePlanBootstrapService.name);

  constructor(private readonly provider: StripeSubscriptionProvider) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.provider.isConfigured()) return;

    try {
      await this.provider.ensurePlansBootstrapped();
    } catch (error) {
      // Не валим старт backend из-за временного сбоя Stripe API — платный
      // чекаут окажется недоступен до следующего рестарта/ручного вызова,
      // но Free/Enterprise и весь остальной продукт не должны зависеть от
      // доступности Stripe при старте.
      this.logger.error(`Не удалось забутстрапить Stripe-тарифы: ${(error as Error).message}`);
    }
  }
}
