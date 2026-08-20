import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, RequestUser } from '../types/authenticated-request';

/** Достаёт `request.user`, положенный туда `SessionAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
