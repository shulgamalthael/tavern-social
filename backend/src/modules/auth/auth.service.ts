import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OAuthProvider, User } from '@prisma/client';
import * as argon2 from 'argon2';
import type { AppConfig } from '@/config/configuration';
import { OAuthExchangeService } from '@/infrastructure/redis/oauth-exchange.service';
import { OAuthStateService } from '@/infrastructure/redis/oauth-state.service';
import { SessionsService } from '@/infrastructure/redis/sessions.service';
import { SocketTicketsService } from '@/infrastructure/redis/socket-tickets.service';
import { UsersService } from '@/modules/users/users.service';
import type { GoogleProfile } from './providers/google-oauth-adapter.service';
import { GoogleOAuthAdapter } from './providers/google-oauth-adapter.service';
import type { AuthSession } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly frontendUrl: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly socketTicketsService: SocketTicketsService,
    private readonly googleOAuthAdapter: GoogleOAuthAdapter,
    private readonly oauthStateService: OAuthStateService,
    private readonly oauthExchangeService: OAuthExchangeService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService.get<AppConfig>('app')!.frontendUrl;
  }

  async register(dto: RegisterDto): Promise<AuthSession> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    const token = await this.sessionsService.create(user.id);
    return { token, user: this.usersService.toMeProfile(user) };
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.usersService.findByEmail(dto.email);
    // `user.passwordHash` — null для аккаунтов, заведённых только через OAuth
    // (см. `schema.prisma`'s комментарий на `User.passwordHash`). Тот же
    // общий "Неверный email или пароль" ниже для отсутствующего пользователя
    // И для OAuth-only аккаунта — не различаем эти случаи в ответе, чтобы не
    // палить, какие email вообще зарегистрированы и как именно.
    const passwordMatches = user?.passwordHash
      ? await argon2.verify(user.passwordHash, dto.password)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const token = await this.sessionsService.create(user.id);
    return { token, user: this.usersService.toMeProfile(user) };
  }

  async logout(token: string): Promise<void> {
    await this.sessionsService.revoke(token);
  }

  async issueSocketTicket(userId: string): Promise<string> {
    return this.socketTicketsService.issue(userId);
  }

  /** `GET /auth/google` — выдаёт CSRF `state` и строит URL Google-согласия. */
  async buildGoogleAuthorizationUrl(): Promise<string> {
    const state = await this.oauthStateService.issue();
    return this.googleOAuthAdapter.buildAuthorizationUrl(state);
  }

  /**
   * `GET /auth/google/callback` — проверяет `state`, меняет `code` на
   * профиль, находит/заводит пользователя, выпускает сессию и возвращает
   * ГОТОВЫЙ URL для редиректа браузера на frontend (`/auth/callback?code=`)
   * с ОДНОРАЗОВЫМ кодом обмена, не сам session-токен (см.
   * `OAuthExchangeService`'s комментарий).
   */
  async completeGoogleLogin(code: string, state: string): Promise<string> {
    const stateValid = await this.oauthStateService.consume(state);
    if (!stateValid) {
      throw new UnauthorizedException(
        'OAuth state недействителен или истёк — попробуйте войти заново',
      );
    }

    const profile = await this.googleOAuthAdapter.exchangeCodeForProfile(code);
    if (!profile.emailVerified) {
      throw new UnauthorizedException('Email в Google-аккаунте должен быть подтверждён');
    }

    const user = await this.findOrCreateOAuthUser('google', profile);
    const token = await this.sessionsService.create(user.id);
    const exchangeCode = await this.oauthExchangeService.issue(token);
    return `${this.frontendUrl}/auth/callback?code=${exchangeCode}`;
  }

  /** Куда редиректить браузер, если OAuth-flow сорвался на любом шаге
   * (пользователь отклонил согласие, `state`/`code` невалидны, Google
   * недоступен) — `AuthController` ловит исключение из `completeGoogleLogin`
   * и всегда делает редирект, никогда не отдаёт голый JSON-error браузеру,
   * который сюда попал НАВИГАЦИЕЙ (а не программным вызовом API). */
  googleLoginErrorRedirectUrl(): string {
    return `${this.frontendUrl}/auth?error=oauth_failed`;
  }

  /** `POST /auth/exchange` — меняет одноразовый код на настоящий `AuthSession`,
   * тем же форматом ответа, что и `login`/`register`, так что frontend
   * применяет один и тот же `setSessionCookie` вне зависимости от способа входа. */
  async exchangeOAuthCode(code: string): Promise<AuthSession> {
    const token = await this.oauthExchangeService.consume(code);
    if (!token) {
      throw new UnauthorizedException('Код обмена недействителен, истёк или уже использован');
    }
    const userId = await this.sessionsService.resolve(token);
    if (!userId) {
      throw new UnauthorizedException('Сессия недействительна');
    }
    const user = await this.usersService.findByIdOrThrow(userId);
    return { token, user: this.usersService.toMeProfile(user) };
  }

  /** Единая find-or-create-or-link логика, переиспользуемая будущими
   * провайдерами (Facebook/Apple) — сначала по уже привязанному
   * `OAuthAccount` (id провайдера, не email), иначе по email (авто-линковка:
   * провайдер уже подтвердил владение email, см. `GoogleProfile.emailVerified`
   * проверку выше), иначе — новый пользователь без пароля. */
  private async findOrCreateOAuthUser(
    provider: OAuthProvider,
    profile: GoogleProfile,
  ): Promise<User> {
    const existingLink = await this.usersService.findByOAuthAccount(
      provider,
      profile.providerAccountId,
    );
    if (existingLink) {
      return existingLink;
    }

    const existingByEmail = await this.usersService.findByEmail(profile.email);
    if (existingByEmail) {
      await this.usersService.linkOAuthAccount(
        existingByEmail.id,
        provider,
        profile.providerAccountId,
      );
      return existingByEmail;
    }

    return this.usersService.createFromOAuth({
      email: profile.email,
      name: profile.name,
      provider,
      providerAccountId: profile.providerAccountId,
    });
  }
}
