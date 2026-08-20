import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SessionsService } from '@/infrastructure/redis/sessions.service';
import { SocketTicketsService } from '@/infrastructure/redis/socket-tickets.service';
import { UsersService } from '@/modules/users/users.service';
import type { AuthSession } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly socketTicketsService: SocketTicketsService,
  ) {}

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
    const passwordMatches = user ? await argon2.verify(user.passwordHash, dto.password) : false;

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
}
