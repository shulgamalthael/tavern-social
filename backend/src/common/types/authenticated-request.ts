import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

export interface RequestUser {
  id: string;
  /** Загружается `SessionAuthGuard` вместе с проверкой бана — так `AdminGuard`
   * (см. `common/guards/admin.guard.ts`) не бьёт по базе второй раз. */
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
