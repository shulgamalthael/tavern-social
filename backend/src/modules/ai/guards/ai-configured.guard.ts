import {
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { LlmProvider } from '../llm-provider';

/**
 * Проверяет, что LLM-провайдер вообще настроен (`GEMINI_API_KEY` в `.env`) —
 * применяется только к маршрутам, которые реально зовут провайдера
 * (`chat`, `chat/stream`), не ко всему `AiController` (`GET activity`
 * читает только `AuditLog`, провайдер ей не нужен — см. `AiOwnershipGuard`
 * про то, почему это два guard'а, а не один). Синхронная проверка, гонки с
 * `@Sse()`'s заголовками-по-таймеру для неё нет (как есть, например, у
 * async DB-проверки в `AiOwnershipGuard`) — но живёт как `Guard`, а не
 * внутри сервиса, ради того же единообразия и той же гарантии (guard'ы
 * прогоняются ДО SSE-специфичной настройки Nest'а).
 */
@Injectable()
export class AiConfiguredGuard implements CanActivate {
  constructor(private readonly llmProvider: LlmProvider) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.llmProvider.isConfigured()) {
      throw new ServiceUnavailableException('AI ещё не настроен на этом сервере');
    }
    return true;
  }
}
