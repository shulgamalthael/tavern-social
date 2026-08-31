import { HttpException, HttpStatus } from '@nestjs/common';
import type { AiBudgetScope } from '@prisma/client';
import type { AiCapacityStatus } from './ai-capacity.lib';

/** Тот же приём, что `GeminiRpdExceededError` и соседи в прошлой итерации —
 * объект `{ message, error }`, не голая строка (см. их комментарий про
 * `HttpExceptionFilter`). */
function body(message: string): { message: string; error: string; statusCode: number } {
  return { message, error: 'Too Many Requests', statusCode: HttpStatus.TOO_MANY_REQUESTS };
}

/** §10-11 brief'а — запрос отклонён Capacity Manager'ом ДО обращения к
 * Gemini: `status=critical` и приоритет `low`, либо `status=emergency` и
 * приоритет не `high`. Отличается от `GeminiRpmQueueTimeoutError`/
 * `GeminiRpdExceededError` из `quota/` — те про фактический лимит Gemini,
 * эта — про НАШУ собственную политику приоритезации поверх него. */
export class AiCapacityBlockedError extends HttpException {
  constructor(status: AiCapacityStatus) {
    super(
      body(
        `AI временно недоступен для операций этого приоритета — текущая нагрузка: ${status}. Попробуйте позже.`,
      ),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/** §17 brief'а — hard-лимит бюджета (global или конкретного бизнеса)
 * исчерпан, а приоритет операции не `high` (см. `AiBudgetService.
 * checkBudgetAdmission`: `high`-приоритет бюджетом не блокируется никогда —
 * не ухудшаем реальный пользовательский UX ради бюджетной дисциплины). */
export class AiBudgetExceededError extends HttpException {
  constructor(scope: AiBudgetScope) {
    super(
      body(
        scope === 'global'
          ? 'Достигнут общий месячный бюджет на AI. Операции этого приоритета временно недоступны.'
          : 'Достигнут месячный AI-бюджет этого бизнеса. Операции этого приоритета временно недоступны.',
      ),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
