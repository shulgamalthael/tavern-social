import { createHash } from 'node:crypto';
import type { LlmMessage } from '../llm-provider';

/** Отпечаток одного AI-хода — `operation` + `businessId` + ПОЛНАЯ история
 * сообщений этого хода (не только последнее сообщение пользователя): внутри
 * одного пользовательского сообщения `runToolLoop` вызывает `AiGatewayService.
 * chat()` несколько раз подряд с растущим `messages` (см. `AiService`) — если
 * бы отпечаток строился только по первому сообщению, все раунды одного хода
 * получили бы ОДИНАКОВЫЙ отпечаток и второй раунд считался бы "дублем"
 * первого, хотя это разные вызовы модели. Полная история даёт разный
 * отпечаток на каждый раунд одного хода, но одинаковый для честного дубля —
 * например, повторного клика "отправить" с тем же текстом до того, как кнопка
 * успела задизейблиться. */
export function computeAiRequestFingerprint(
  operation: string,
  businessId: string | undefined,
  messages: LlmMessage[],
): string {
  const hash = createHash('sha256');
  hash.update(operation);
  hash.update('|');
  hash.update(businessId ?? '');
  hash.update('|');
  hash.update(JSON.stringify(messages));
  return hash.digest('hex');
}
