import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionsService } from '@/infrastructure/redis/sessions.service';
import { extractBearerToken } from '../lib/extract-bearer-token';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Единственный рубеж авторизации backend-API: ищет `Authorization: Bearer <token>`,
 * резолвит его в userId через SessionsService (Redis) и кладёт в `request.user`.
 * Используется явно через `@UseGuards(SessionAuthGuard)` на защищённых контроллерах —
 * не глобально, чтобы публичные роуты (login/register) оставались читаемо публичными.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

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

    request.user = { id: userId };
    return true;
  }
}
