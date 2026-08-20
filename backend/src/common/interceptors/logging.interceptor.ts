import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

/**
 * Логирует метод/путь/статус/длительность каждого HTTP-запроса.
 * Не логирует тело запроса/ответа — там могут быть пароли и другие
 * чувствительные данные (см. AGENTS.md backend, раздел про логирование).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${originalUrl} — ${Date.now() - startedAt}ms`);
        },
        error: (error: unknown) => {
          const detail = error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(`${method} ${originalUrl} — ${Date.now() - startedAt}ms — ${detail}`);
        },
      }),
    );
  }
}
