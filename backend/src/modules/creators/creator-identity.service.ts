import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '@/config/configuration';

/**
 * Обёртка над `stripe.identity.*` (Creator Monetization Phase 1,
 * AI_PLATFORM_ROADMAP.md §79) — тот же "один платформенный Stripe-аккаунт,
 * свой Stripe-клиент на область" принцип, что у `StripeSubscriptionAdapter`
 * (`modules/billing`) относительно `StripeAdapter` (`modules/payments`):
 * держит `CreatorsModule` независимым, не переиспользует чужую реализацию.
 *
 * В отличие от `PaymentProvider`/`StripeSubscriptionProvider`, здесь НЕТ
 * отдельного абстрактного класса — область (верификация личности) намного
 * у́же (создать сессию + разобрать один вебхук), и второй реализации не
 * предвидится: абстракция ради абстракции здесь была бы лишней (см.
 * AGENTS.md backend §1 про то же самое рассуждение).
 *
 * САМ документ/селфи никогда не долетает до этого backend — пользователь
 * загружает их напрямую в Stripe (`stripe.verifyIdentity(clientSecret)` на
 * фронтенде), сюда возвращается только id сессии и, отдельно, вердикт через
 * вебхук. Единственная причина, по которой это вообще безопасно хранить как
 * "не хранить лишние данные" — see корневой план фичи.
 */
export type CreatorIdentityWebhookEvent =
  | { type: 'verified'; sessionId: string }
  | { type: 'requires_input'; sessionId: string; reason: string | null }
  | { type: 'canceled'; sessionId: string };

@Injectable()
export class CreatorIdentityService {
  private readonly logger = new Logger(CreatorIdentityService.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string | undefined;

  constructor(configService: ConfigService) {
    const config = configService.get<AppConfig>('app')!;
    this.webhookSecret = config.stripeIdentityWebhookSecret;
    this.stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

    if (!this.stripe) {
      this.logger.warn('STRIPE_SECRET_KEY не задан — верификация личности Creator недоступна');
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null && Boolean(this.webhookSecret);
  }

  async createVerificationSession(
    userId: string,
    creatorProfileId: string,
  ): Promise<{ sessionId: string; clientSecret: string }> {
    if (!this.stripe) {
      throw new Error('Верификация личности недоступна: Stripe не настроен');
    }

    const session = await this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId, creatorProfileId },
    });

    if (!session.client_secret) {
      throw new Error('Stripe не вернул client_secret для сессии верификации');
    }

    return { sessionId: session.id, clientSecret: session.client_secret };
  }

  /** `null` — подпись неверна/событие непонятного типа, вызывающий (см.
   * `StripeIdentityWebhookController`) отвечает 400, ничего не меняя. */
  parseWebhookEvent(payload: Buffer, signature: string): CreatorIdentityWebhookEvent | null {
    if (!this.stripe || !this.webhookSecret) return null;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      this.logger.warn(
        `Неверная подпись вебхука Stripe Identity: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }

    if (event.type === 'identity.verification_session.verified') {
      const session = event.data.object;
      return { type: 'verified', sessionId: session.id };
    }
    if (event.type === 'identity.verification_session.requires_input') {
      const session = event.data.object;
      return {
        type: 'requires_input',
        sessionId: session.id,
        reason: session.last_error?.reason ?? null,
      };
    }
    if (event.type === 'identity.verification_session.canceled') {
      const session = event.data.object;
      return { type: 'canceled', sessionId: session.id };
    }

    return null;
  }
}
