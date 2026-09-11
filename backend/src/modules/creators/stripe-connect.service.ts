import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '@/config/configuration';

/**
 * Обёртка над Stripe Connect (Creator Monetization Phase 5, AI_PLATFORM_
 * ROADMAP.md §83) — реальные выплаты creator'у. Тот же принцип "узкая
 * область, свой Stripe-клиент, без отдельного абстрактного класса", что у
 * `CreatorIdentityService` (см. её комментарий) — второй реализации не
 * предвидится.
 *
 * Использует v2 Accounts API (`stripe.v2.core.accounts`), не устаревший v1
 * `stripe.accounts.create` — подтверждено живым вызовом против реального
 * тестового Stripe-аккаунта этого проекта: v1 отклоняется самим Stripe
 * ("Stripe no longer recommends Accounts v1 for new Connect integrations").
 * Аккаунт создаётся с ЕДИНСТВЕННОЙ конфигурацией `recipient` (не `customer`/
 * `merchant`) — creator здесь получатель выплат, не покупатель и не продавец
 * на своём сайте. `defaults.responsibilities.fees_collector/losses_collector:
 * 'application'` — обязательное поле именно для этой комбинации конфигурации
 * (подтверждено живым вызовом: значение `'stripe'` Stripe сам отклоняет для
 * такого набора capability).
 *
 * Реальный перевод денег (`createTransfer`) — через уже существующий v1
 * `stripe.transfers.create` (не отдельный v2-эндпоинт): подтверждено живым
 * вызовом, что v1 Transfers API корректно работает с v2-аккаунтом как
 * `destination`, если у аккаунта включена капабилити `stripe_balance.
 * stripe_transfers` — до включения Stripe сам отклоняет перевод понятной
 * ошибкой `insufficient_capabilities_for_transfer`, которую `NativeAdPayoutsService`
 * превращает в `status: 'failed'` с человекочитаемой причиной, а не 500.
 *
 * Онбординг — ТОЛЬКО через хостед-страницу Stripe (`accountLinks.create`):
 * платформа НЕ может принять Terms of Service или личные данные creator'а
 * от его имени напрямую через API — подтверждено живым вызовом
 * (`tos_acceptance_on_behalf_not_allowed`) для Express-аккаунтов с
 * `dashboard: 'express'`, у которых Stripe сам владеет сбором требований.
 * Статус аккаунта поэтому не отслеживается вебхуком (v2 API использует
 * принципиально другой механизм доставки событий — "thin events" через
 * `eventDestinations`, отдельная инфраструктура от уже существующего
 * classic-webhook `StripeWebhookController`) — вместо этого `refreshStatus`
 * перечитывает реальный статус аккаунта у Stripe live, при явном обращении
 * (открытие Creator Studio, возврат с хостед-онбординга) — та же "не
 * кэшировать, что не является горячим путём" экономика, что и у
 * `NativeAdRevenueSettingsService.get()`.
 */
export type StripeConnectAccountStatus = 'onboarding' | 'active';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly stripe: Stripe | null;
  private readonly frontendUrl: string;

  constructor(configService: ConfigService) {
    const config = configService.get<AppConfig>('app')!;
    this.frontendUrl = config.frontendUrl;
    this.stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

    if (!this.stripe) {
      this.logger.warn('STRIPE_SECRET_KEY не задан — выплаты Stripe Connect недоступны');
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /** Создаёт v2-аккаунт (если `existingAccountId` не передан) и всегда
   * создаёт новую ссылку на онбординг — ссылки одноразовые/недолговечные,
   * подтверждено живым вызовом (повторное использование даёт `net::
   * ERR_CONNECTION_REFUSED` на хостед-странице). */
  async createOnboardingLink(
    existingAccountId: string | null,
    contactEmail: string,
  ): Promise<{ accountId: string; url: string }> {
    if (!this.stripe) throw new Error('Stripe Connect недоступен: Stripe не настроен');

    // `contact_email` обязателен для аккаунта с `configuration.recipient`
    // (подтверждено живым вызовом: без него Stripe отклоняет создание с
    // "the Account must have a contact email") — используем email самого
    // creator'а, не платформенный, чтобы уведомления Stripe (например, о
    // проблемах с выплатой) доходили до него, а не терялись.
    const accountId =
      existingAccountId ??
      (
        await this.stripe.v2.core.accounts.create({
          contact_email: contactEmail,
          dashboard: 'express',
          identity: { entity_type: 'individual', country: 'US' },
          defaults: {
            responsibilities: { fees_collector: 'application', losses_collector: 'application' },
          },
          configuration: {
            recipient: {
              capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
            },
          },
        })
      ).id;

    const returnUrl = `${this.frontendUrl}/creator/studio`;
    const link = await this.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: returnUrl,
          return_url: returnUrl,
        },
      },
    });

    return { accountId, url: link.url };
  }

  /** Живой опрос реального статуса у Stripe — не кэшируется (см. комментарий
   * класса). `null` — аккаунта ещё нет вообще (не должно вызываться в этом
   * случае, но на всякий случай не бросает). */
  async getAccountStatus(accountId: string): Promise<StripeConnectAccountStatus> {
    if (!this.stripe) throw new Error('Stripe Connect недоступен: Stripe не настроен');

    const account = await this.stripe.v2.core.accounts.retrieve(accountId, {
      include: ['configuration.recipient'],
    });
    const transfersStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
    return transfersStatus === 'active' ? 'active' : 'onboarding';
  }

  /** Реальный перевод денег с платформенного баланса Stripe на аккаунт
   * creator'а. Бросает, если capability ещё не включена — вызывающий
   * (`NativeAdPayoutsService.process`) ловит это и переводит выплату в
   * `status: 'failed'`, а не роняет запрос администратора 500-й. */
  async createTransfer(
    accountId: string,
    amountCents: number,
    currency: string,
  ): Promise<{ transferId: string }> {
    if (!this.stripe) throw new Error('Stripe Connect недоступен: Stripe не настроен');

    const transfer = await this.stripe.transfers.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      destination: accountId,
    });
    return { transferId: transfer.id };
  }
}
