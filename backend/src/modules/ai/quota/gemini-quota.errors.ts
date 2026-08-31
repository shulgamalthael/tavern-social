import { HttpException, HttpStatus } from '@nestjs/common';

/** Все три — `HttpException`, не голый `Error`: `HttpExceptionFilter`
 * (`backend/src/common/filters/http-exception.filter.ts`) отдаёт наружу
 * `message` только для `HttpException`, любой другой `Error` маскируется до
 * generic "Внутренняя ошибка сервера" — без этого различия пользователь
 * снова получал бы голый 500 вместо понятной причины (тот же класс проблемы,
 * что уже был найден и починен для follow-up-вызова в `AiService.runToolLoop`,
 * см. её комментарий). `chatStream()`'s SSE-путь читает у брошенного
 * исключения только `.message` (Nest формирует `event: error` сам) — тот же
 * текст, что уйдёт и в JSON-ответ обычного `chat()`, так что оба вызывающих
 * получают одинаково понятную причину без отдельной обработки для каждого.
 *
 * Конструктор `HttpException` вызван с ОБЪЕКТОМ `{ message, error }`, не
 * голой строкой — в отличие от строки, объект `HttpExceptionFilter`
 * распознаёт как структурированное тело (`typed.error ?? HttpStatus[status]`)
 * и берёт `error` из него; при голой строке `getResponse()` возвращает эту
 * же строку без обёртки, и фильтр остаётся на дефолтном `error: 'Internal
 * Server Error'` даже при верном `statusCode: 429` (проверено вживую —
 * см. `AI_PLATFORM_ROADMAP.md`-стиль верификации, не по документации: Nest'овские
 * `BadRequestException` и т. п. сами оборачивают строку в такой же объект,
 * `HttpException`-база — нет). */
function quotaErrorBody(message: string): { message: string; error: string; statusCode: number } {
  return { message, error: 'Too Many Requests', statusCode: HttpStatus.TOO_MANY_REQUESTS };
}

export class GeminiRpdExceededError extends HttpException {
  constructor(resetAt: Date) {
    super(
      quotaErrorBody(
        `Дневной лимит запросов к AI на сегодня исчерпан. Попробуйте после ` +
          `${resetAt.toLocaleString('ru-RU', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' })} ` +
          `по тихоокеанскому времени — именно тогда Gemini сбрасывает дневную квоту.`,
      ),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class GeminiRpmQueueTimeoutError extends HttpException {
  constructor() {
    super(
      quotaErrorBody(
        'AI сейчас перегружен запросами — попробуйте отправить сообщение ещё раз через немного времени.',
      ),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class GeminiRetriesExhaustedError extends HttpException {
  constructor() {
    super(
      quotaErrorBody(
        'Gemini временно отклоняет запросы (лимит скорости). Попробуйте ещё раз через минуту.',
      ),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
