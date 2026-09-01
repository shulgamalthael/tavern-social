/** Общий профиль, который любой OAuth-адаптер (`GoogleOAuthAdapter`,
 * `FacebookOAuthAdapter`, ...) возвращает после успешного обмена authorization
 * code — форма одна и та же независимо от провайдера, `AuthService`'s
 * find-or-create логика (`findOrCreateOAuthUser`) работает с ней, не зная
 * деталей конкретного провайдера. */
export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Контракт одного OAuth-провайдера (authorization code flow) — реализуют
 * `GoogleOAuthAdapter`/`FacebookOAuthAdapter`, зарегистрированные в
 * `OAuthProviderRegistry`. Второй провайдер (Facebook) появился после
 * первого (Google) — этот интерфейс выделен именно тогда, не заранее
 * (см. AGENTS.md: не строить абстракции про запас). */
export interface OAuthAdapter {
  isConfigured(): boolean;
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForProfile(code: string): Promise<OAuthProfile>;
}
