import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Ошибки Express-уровня middleware (body-parser и т. п.) — например
 * `PayloadTooLargeError` на слишком большом теле запроса — бросаются ДО
 * того, как запрос доходит до Nest pipes/controllers, поэтому это обычные
 * `Error` с числовым `status`/`statusCode`, а не `HttpException`. Без этой
 * проверки такая (полностью ожидаемая, клиентская) ошибка тонула в общем
 * `else`-branch ниже и превращалась в 500 вместо честного 413/400.
 */
function extractClientErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const candidate =
    (exception as { status?: unknown }).status ??
    (exception as { statusCode?: unknown }).statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 500 ? candidate : null;
}

/**
 * Единая форма ошибок для всего API: { statusCode, error, message, path, timestamp }.
 * Неожиданные (не-HttpException, не клиентские) ошибки логируются с полным
 * стеком, но наружу уходит только generic-сообщение — не раскрываем
 * внутренности backend.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string }>();

    const isHttpException = exception instanceof HttpException;
    const clientErrorStatus = isHttpException ? null : extractClientErrorStatus(exception);
    const status = isHttpException
      ? exception.getStatus()
      : (clientErrorStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    let message: string | string[] = 'Внутренняя ошибка сервера';
    let error = 'Internal Server Error';

    if (isHttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const typed = body as { message?: string | string[]; error?: string };
        message = typed.message ?? exception.message;
        error = typed.error ?? HttpStatus[status];
      }
    } else if (clientErrorStatus === HttpStatus.PAYLOAD_TOO_LARGE) {
      message = 'Слишком большой запрос';
      error = 'Payload Too Large';
      this.logger.warn(exception instanceof Error ? exception.message : String(exception));
    } else if (clientErrorStatus) {
      message = 'Некорректный запрос';
      error = HttpStatus[clientErrorStatus] ?? 'Bad Request';
      this.logger.warn(exception instanceof Error ? exception.message : String(exception));
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
        undefined,
        'UnhandledException',
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
