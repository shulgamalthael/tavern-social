import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import type { OAuthAdapter, OAuthProfile } from './oauth-adapter';

// Версия Graph API закреплена явно (не «последняя»/без версии) — Facebook
// снимает старые версии с поддержки по расписанию, зависать на «текущей на
// момент написания» без явного номера значит однажды сломаться без
// предупреждения в коде.
const FACEBOOK_API_VERSION = 'v21.0';
const FACEBOOK_AUTH_URL = `https://www.facebook.com/${FACEBOOK_API_VERSION}/dialog/oauth`;
const FACEBOOK_TOKEN_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/oauth/access_token`;
const FACEBOOK_USERINFO_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/me`;

interface FacebookTokenResponse {
  access_token: string;
}

interface FacebookUserInfoResponse {
  id: string;
  email?: string;
  name?: string;
}

/**
 * Facebook Login (authorization code flow) — тот же приём, что
 * `GoogleOAuthAdapter` (голый `fetch`, не `passport`), реализует общий
 * `OAuthAdapter`. Единственное реальное отличие от Google: Graph API не
 * возвращает `email_verified` вообще — Facebook сам не отдаёт email, пока
 * пользователь его не подтвердил на своей стороне, так что `emailVerified`
 * здесь всегда `true`, когда `email` присутствует (см. `exchangeCodeForProfile`).
 */
@Injectable()
export class FacebookOAuthAdapter implements OAuthAdapter {
  private readonly logger = new Logger(FacebookOAuthAdapter.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string;

  constructor(configService: ConfigService) {
    const config = configService.get<AppConfig>('app')!;
    this.clientId = config.facebookClientId;
    this.clientSecret = config.facebookClientSecret;
    this.redirectUri = `${config.oauthCallbackBaseUrl}/auth/facebook/callback`;

    if (!this.isConfigured()) {
      this.logger.warn(
        'FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET не заданы — вход через Facebook отключён',
      );
    }
  }

  isConfigured(): boolean {
    return this.clientId !== undefined && this.clientSecret !== undefined;
  }

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });
    return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<OAuthProfile> {
    if (!this.isConfigured()) {
      throw new Error('FacebookOAuthAdapter вызван без настроенных client id/secret');
    }

    const tokenParams = new URLSearchParams({
      code,
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      redirect_uri: this.redirectUri,
    });
    const tokenResponse = await fetch(`${FACEBOOK_TOKEN_URL}?${tokenParams.toString()}`);
    if (!tokenResponse.ok) {
      throw new Error(`Facebook token exchange failed: ${tokenResponse.status}`);
    }
    const tokenBody = (await tokenResponse.json()) as FacebookTokenResponse;

    const userInfoParams = new URLSearchParams({
      fields: 'id,name,email',
      access_token: tokenBody.access_token,
    });
    const userInfoResponse = await fetch(`${FACEBOOK_USERINFO_URL}?${userInfoParams.toString()}`);
    if (!userInfoResponse.ok) {
      throw new Error(`Facebook userinfo fetch failed: ${userInfoResponse.status}`);
    }
    const info = (await userInfoResponse.json()) as FacebookUserInfoResponse;
    if (!info.email) {
      throw new Error(
        'Facebook-аккаунт не вернул email — у аккаунта не подтверждён email или это не было разрешено при входе',
      );
    }

    return {
      providerAccountId: info.id,
      email: info.email,
      // Facebook не отдаёт отдельный флаг подтверждения — сам факт, что Graph
      // API вернул email, уже означает, что он подтверждён на стороне Facebook.
      emailVerified: true,
      name: info.name ?? info.email,
    };
  }
}
