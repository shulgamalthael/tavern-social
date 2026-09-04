import type { AiStreamEvent } from '../model/types';

export class AiChatStreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiChatStreamError';
  }
}

interface BackendErrorBody {
  message?: string | string[];
}

function extractErrorMessage(body: unknown): string {
  const typed = body as BackendErrorBody | null;
  if (!typed?.message) return 'Не удалось отправить сообщение — попробуйте ещё раз';
  return Array.isArray(typed.message) ? typed.message.join(', ') : typed.message;
}

/**
 * Один SSE-фрейм: `event:`/`id:`/`data:`-строки, разделённые `\n\n` (см.
 * `SseStream` в `@nestjs/core` на backend). Разбирает только то, что реально
 * шлёт `AiController.chatStream` — не полная реализация спецификации SSE
 * (нет `retry:`, комментариев `:`-строк, продолжений через несколько
 * `data:`-строк — Nest их и не шлёт, т.к. каждый `data` у нас — одна JSON-
 * строка без переносов, см. `JSON.stringify`).
 */
function parseSseFrame(raw: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/**
 * Клиентский (браузерный, не Server Action) стриминг чата с AI-ассистентом —
 * `POST /businesses/:businessId/ai/chat/stream` (`AiController`, AI-3, см.
 * AI_PLATFORM_ROADMAP.md) нельзя вызвать через Server Action: та возвращает
 * один сериализованный результат, а не постепенно читаемый поток. Вместо
 * этого — Route Handler-прокси (`app/api/ai-chat/route.ts`), который сам
 * подставляет токен сессии из httpOnly cookie на сервере (браузер его не
 * видит) и прозрачно перекачивает SSE-тело backend в ответ. Здесь — обычный
 * `fetch` с ручным построчным разбором `response.body`, а не `EventSource`:
 * `EventSource` не умеет POST с телом, а сообщение пользователя нужно
 * отправлять в теле (потенциально длинный текст), не в query.
 *
 * `event: error`-фреймы (сбой LLM-провайдера/лимит итераций — их формирует
 * сам Nest, см. `AiService.runToolLoop`) бросаются как `AiChatStreamError`,
 * не JSON — `data` там обычный текст ошибки, не структурированный эвент.
 */
export async function* streamAiChat(
  businessId: string,
  message: string,
  attachmentIds: string[] = [],
  signal?: AbortSignal,
): AsyncGenerator<AiStreamEvent> {
  let response: Response;
  try {
    response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, message, attachmentIds }),
      signal,
    });
  } catch {
    throw new AiChatStreamError('Сервер недоступен, попробуйте позже');
  }

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as unknown;
    throw new AiChatStreamError(extractErrorMessage(body), response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawFrame = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const frame = parseSseFrame(rawFrame);
      if (!frame) continue;

      if (frame.event === 'error') {
        throw new AiChatStreamError(frame.data);
      }

      yield JSON.parse(frame.data) as AiStreamEvent;
    }
  }
}
