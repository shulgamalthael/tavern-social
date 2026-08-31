import { Logger } from '@nestjs/common';
import type { AiPriority } from '@prisma/client';

const logger = new Logger('AiOperationsRegistry');

export type AiOperationCategory = 'chat' | 'onboarding';

export interface AiOperationDefinition {
  priority: AiPriority;
  category: AiOperationCategory;
}

/** Единственное место, определяющее приоритет AI-операции — используется и
 * при отправке (`AiCapacityService.shouldAdmit`), и при записи телеметрии
 * (`AiRequestAccountingService`). Сегодня оба реальных сценария — `high`
 * (пользователь ждёт ответа синхронно в этом же HTTP/SSE-запросе); `medium`/
 * `low` пока не имеют ни одного реального потребителя — см.
 * `AiPriority`-комментарий в схеме. */
export const AI_OPERATIONS: Record<string, AiOperationDefinition> = {
  business_chat: { priority: 'high', category: 'chat' },
  onboarding_chat: { priority: 'high', category: 'onboarding' },
};

/** `medium`, не `high` и не `low` — сознательный выбор дефолта для ЕЩЁ НЕ
 * зарегистрированной операции (опечатка в имени, забытая регистрация новой
 * операции): `high` тихо освобождал бы её от любого throttling при
 * CRITICAL/EMERGENCY (риск для бюджета), `low` неожиданно резал бы то, что
 * могло быть реальным пользовательским сценарием. `medium` — throttled под
 * CRITICAL/EMERGENCY, но не под WARNING, и предупреждение в лог делает
 * пропуск регистрации заметным, а не молча проглоченным. */
export function getAiOperationDefinition(operation: string): AiOperationDefinition {
  const definition = AI_OPERATIONS[operation];
  if (!definition) {
    logger.warn(
      `Операция "${operation}" не зарегистрирована в AI_OPERATIONS — используется приоритет medium`,
    );
    return { priority: 'medium', category: 'chat' };
  }
  return definition;
}
