import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Третий рубеж поверх `SessionAuthGuard` + `AdminGuard` — только для
 * маршрута выдачи/снятия супер-прав (`AdminController`,
 * `PATCH /admin/users/:id/super-admin`): обычный админ не может ни сделать
 * кого-то супер-админом, ни снять супер-права с другого — иначе весь смысл
 * защищённого уровня терялся бы. `isSuperAdmin` уже загружен
 * `SessionAuthGuard` в `request.user`, здесь только проверка.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user.isSuperAdmin) {
      throw new ForbiddenException('Доступно только супер-администраторам');
    }
    return true;
  }
}
