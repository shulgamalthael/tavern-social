import { Injectable } from '@nestjs/common';
import type { OAuthProvider } from '@prisma/client';
import { FacebookOAuthAdapter } from './facebook-oauth-adapter.service';
import { GoogleOAuthAdapter } from './google-oauth-adapter.service';
import type { OAuthAdapter } from './oauth-adapter';

/** Провайдеры, у которых реально есть адаптер — подмножество Prisma's
 * `OAuthProvider` (тот также содержит `apple`, для которого адаптера пока
 * нет вообще, см. AI_PLATFORM_ROADMAP.md §36.4). Отдельный тип, а не весь
 * `OAuthProvider`, — так `isKnownProvider`/`get` не дают ложно решить, что
 * `apple` уже поддержан. */
export type RegisteredOAuthProvider = Extract<OAuthProvider, 'google' | 'facebook'>;

const REGISTERED_PROVIDERS: readonly RegisteredOAuthProvider[] = ['google', 'facebook'];

/**
 * Единая точка «имя провайдера → адаптер» для generic-роутов `GET /auth/
 * :provider`/`GET /auth/:provider/callback` (`AuthController`) — второй
 * провайдер (Facebook) появился после первого (Google), и именно тогда стало
 * ясно, что нужна регистрация по имени, а не жёстко закодированные
 * `buildGoogleAuthorizationUrl`/`completeGoogleLogin`-методы на каждый
 * провайдер отдельно (см. AGENTS.md: не строить абстракцию раньше второго
 * реального случая).
 */
@Injectable()
export class OAuthProviderRegistry {
  private readonly adapters: Record<RegisteredOAuthProvider, OAuthAdapter>;

  constructor(googleOAuthAdapter: GoogleOAuthAdapter, facebookOAuthAdapter: FacebookOAuthAdapter) {
    this.adapters = { google: googleOAuthAdapter, facebook: facebookOAuthAdapter };
  }

  isKnownProvider(value: string): value is RegisteredOAuthProvider {
    return (REGISTERED_PROVIDERS as string[]).includes(value);
  }

  get(provider: RegisteredOAuthProvider): OAuthAdapter {
    return this.adapters[provider];
  }
}
