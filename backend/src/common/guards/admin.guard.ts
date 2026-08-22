import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Второй рубеж поверх `SessionAuthGuard` — не заменяет его, а добавляется
 * следом (`@UseGuards(SessionAuthGuard, AdminGuard)`, см. `AdminController`):
 * `role` уже загружен `SessionAuthGuard` в `request.user`, здесь только
 * проверка, а не поход в базу второй раз.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.role !== 'admin') {
      throw new ForbiddenException('Доступно только администраторам');
    }
    return true;
  }
}
