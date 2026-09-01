import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

interface GoogleTokenResponse {
  access_token: string;
}

interface GoogleUserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/**
 * Google OAuth 2.0 authorization code flow, реализован напрямую через
 * `fetch` (тот же приём, что `GeminiAdapter`), а не через `passport`/
 * `passport-google-oauth20` — тот тянет за собой Express session middleware,
 * чужеродный текущей архитектуре (opaque-токены в Redis, см. `SessionsService`).
 * `redirectUri` строится из `oauthCallbackBaseUrl` (см. `configuration.ts`) —
 * должен буква-в-букву совпадать с Authorized redirect URI в Google Cloud
 * Console, иначе Google отклонит запрос ДО показа экрана согласия.
 */
@Injectable()
export class GoogleOAuthAdapter {
  private readonly logger = new Logger(GoogleOAuthAdapter.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string;

  constructor(configService: ConfigService) {
    const config = configService.get<AppConfig>('app')!;
    this.clientId = config.googleOAuthClientId;
    this.clientSecret = config.googleOAuthClientSecret;
    this.redirectUri = `${config.oauthCallbackBaseUrl}/auth/google/callback`;

    if (!this.isConfigured()) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET не заданы — вход через Google отключён',
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
      scope: 'openid email profile',
      state,
      // Всегда показывать выбор аккаунта — иначе Google молча переиспользует
      // последнюю Google-сессию браузера, что удивляет на общем компьютере.
      prompt: 'select_account',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** Обменивает authorization code на access token, затем — access token на
   * профиль через userinfo endpoint. Не парсит/не проверяет подпись
   * `id_token` вручную — оба запроса идут напрямую в Google по HTTPS с
   * `client_secret`, так что сам факт успешного ответа уже аутентичен. */
  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    if (!this.isConfigured()) {
      throw new Error('GoogleOAuthAdapter вызван без настроенных client id/secret');
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
    }
    const tokenBody = (await tokenResponse.json()) as GoogleTokenResponse;

    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!userInfoResponse.ok) {
      throw new Error(`Google userinfo fetch failed: ${userInfoResponse.status}`);
    }
    const info = (await userInfoResponse.json()) as GoogleUserInfoResponse;
    if (!info.email) {
      throw new Error('Google-аккаунт не вернул email');
    }

    return {
      providerAccountId: info.sub,
      email: info.email,
      emailVerified: info.email_verified ?? false,
      name: info.name ?? info.email,
    };
  }
}
