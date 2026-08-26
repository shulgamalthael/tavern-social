import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { SessionsService } from '@/infrastructure/redis/sessions.service';
import { extractBearerToken } from '../lib/extract-bearer-token';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Единственный рубеж авторизации backend-API: ищет `Authorization: Bearer <token>`,
 * резолвит его в userId через SessionsService (Redis) и кладёт в `request.user`.
 * Используется явно через `@UseGuards(SessionAuthGuard)` на защищённых контроллерах —
 * не глобально, чтобы публичные роуты (login/register) оставались читаемо публичными.
 *
 * Заодно читает `role`/`isBanned` — единственное место, которое их проверяет,
 * поэтому забаненный пользователь получает 403 на КАЖДОМ защищённом запросе
 * (не только на входе), и `role` сразу доступен `AdminGuard` без второго
 * похода в базу.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Отсутствует токен сессии');
    }

    const userId = await this.sessionsService.resolve(token);
    if (!userId) {
      throw new UnauthorizedException('Сессия недействительна или истекла');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isSuperAdmin: true, isBanned: true, bannedReason: true },
    });
    if (!user) {
      throw new UnauthorizedException('Сессия недействительна или истекла');
    }
    if (user.isBanned) {
      // Причину бана (если админ её указал) кладём прямо в сообщение — это
      // единственное место, откуда frontend вообще узнаёт о бане (см.
      // `features/auth/api/session.server.ts`, `BannedError`), отдельного
      // запроса за причиной нет.
      throw new ForbiddenException(
        `Аккаунт заблокирован администратором${user.bannedReason ? `: ${user.bannedReason}` : ''}`,
      );
    }

    request.user = { id: userId, role: user.role, isSuperAdmin: user.isSuperAdmin };
    return true;
  }
}
