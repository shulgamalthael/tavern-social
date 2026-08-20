import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { extractBearerToken } from '@/common/lib/extract-bearer-token';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { AuthSession } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
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
}
