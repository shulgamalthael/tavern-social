import type { OnboardingStreamEvent } from '../model/types';

export class AiOnboardingStreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AiOnboardingStreamError';
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

/** Та же ручная разборка SSE-фреймов, что и у `features/ai-chat/api/stream-
 * ai-chat.ts` (см. её комментарий про то, почему не полная спецификация SSE
 * и не `EventSource`) — не вынесена в `shared/lib`, т.к. это ровно две
 * независимые копии из двух слайсов ("features" по FSD не должны знать друг
 * о друге), а дублирование здесь — двадцать строк, не тянет на абстракцию. */
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
 * Клиентский стриминг AI-4 onboarding-диалога (AI_PLATFORM_ROADMAP.md §2.7)
 * — `POST /ai/onboarding/chat` через прокси `app/api/ai-onboarding/route.ts`
 * (тот же приём, что и `streamAiChat`: нужен Route Handler, не Server
 * Action, чтобы читать SSE-тело постепенно, а не одним сериализованным
 * результатом).
 */
export async function* streamAiOnboarding(
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<OnboardingStreamEvent> {
  let response: Response;
  try {
    response = await fetch('/api/ai-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch {
    throw new AiOnboardingStreamError('Сервер недоступен, попробуйте позже');
  }

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as unknown;
    throw new AiOnboardingStreamError(extractErrorMessage(body), response.status);
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
        throw new AiOnboardingStreamError(frame.data);
      }

      yield JSON.parse(frame.data) as OnboardingStreamEvent;
    }
  }
}
