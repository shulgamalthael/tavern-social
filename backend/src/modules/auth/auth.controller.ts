import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { extractBearerToken } from '@/common/lib/extract-bearer-token';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { AuthSession } from './auth.types';
import { AuthService } from './auth.service';
import { ExchangeOAuthCodeDto } from './dto/exchange-oauth-code.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleOAuthConfiguredGuard } from './guards/google-oauth-configured.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto): Promise<AuthSession> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto): Promise<AuthSession> {
    return this.authService.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  async logout(@Req() request: Request): Promise<void> {
    const token = extractBearerToken(request.headers.authorization);
    if (token) {
      await this.authService.logout(token);
    }
  }

  @Post('socket-ticket')
  @UseGuards(SessionAuthGuard)
  async socketTicket(@CurrentUser() currentUser: RequestUser): Promise<{ ticket: string }> {
    const ticket = await this.authService.issueSocketTicket(currentUser.id);
    return { ticket };
  }

  /** Начало Google-входа — реальная навигация браузера (не AJAX), поэтому
   * 302 на Google, а не JSON. Frontend никогда не строит этот URL сам —
   * только переходит на GET /auth/google (см. AGENTS.md, «браузер не
   * обращается к backend напрямую» — здесь это полноценная навигация, не
   * REST-вызов). */
  @Get('google')
  @UseGuards(GoogleOAuthConfiguredGuard)
  async googleLogin(@Res() res: Response): Promise<void> {
    const url = await this.authService.buildGoogleAuthorizationUrl();
    res.redirect(url);
  }

  /** Callback Google — тоже реальная навигация браузера, поэтому ЛЮБОЙ исход
   * (успех или ошибка) заканчивается редиректом на frontend, никогда не
   * голым JSON/500 — пользователь не может «обработать» JSON-ответ,
   * попавший сюда по ссылке из письма Google/кнопки согласия. */
  @Get('google/callback')
  @UseGuards(GoogleOAuthConfiguredGuard)
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error || !code || !state) {
      res.redirect(this.authService.googleLoginErrorRedirectUrl());
      return;
    }

    try {
      const redirectUrl = await this.authService.completeGoogleLogin(code, state);
      res.redirect(redirectUrl);
    } catch (caught) {
      this.logger.warn(
        `Google OAuth callback failed: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
      res.redirect(this.authService.googleLoginErrorRedirectUrl());
    }
  }

  /** Меняет одноразовый код (из query string редиректа `/auth/callback`) на
   * настоящий `AuthSession` — вызывается Server Action'ом frontend, не
   * браузером напрямую, поэтому здесь снова обычный JSON-эндпоинт. */
  @Post('exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async exchange(@Body() dto: ExchangeOAuthCodeDto): Promise<AuthSession> {
    return this.authService.exchangeOAuthCode(dto.code);
  }
}
