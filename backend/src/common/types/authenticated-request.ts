import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

export interface RequestUser {
  id: string;
  /** Загружается `SessionAuthGuard` вместе с проверкой бана — так `AdminGuard`
   * (см. `common/guards/admin.guard.ts`) не бьёт по базе второй раз. */
  role: UserRole;
  /** Аналогично `role` — грузится один раз здесь, чтобы `SuperAdminGuard`
   * (см. `common/guards/super-admin.guard.ts`) не ходил в базу второй раз. */
  isSuperAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
