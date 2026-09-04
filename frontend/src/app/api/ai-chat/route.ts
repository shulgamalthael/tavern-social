import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionToken } from '@/shared/lib/session-token.server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

interface AiChatRequestBody {
  businessId?: unknown;
  message?: unknown;
  attachmentIds?: unknown;
}

/**
 * Прокси-стрим `POST /businesses/:businessId/ai/chat/stream` (`AiController`,
 * AI-3, см. AI_PLATFORM_ROADMAP.md) — единственный Route Handler в проекте,
 * который проксирует backend, а не отдаёт статический ответ (сравни с
 * `app/auth/clear/route.ts`). Нужен именно Route Handler, а не Server Action
 * (обычный способ ходить в backend в этом проекте, см. `shared/lib/backend-
 * client.ts`): клиентский код должен читать тело ответа ПОСТЕПЕННО, по мере
 * поступления SSE-фреймов, а Server Action возвращает один сериализованный
 * результат целиком — стриминг через неё не сделать. Токен сессии
 * подставляется здесь же, на сервере, из httpOnly cookie — браузер его не
 * видит и не может подделать (тот же принцип, что у `backendFetch`).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Сессия истекла — обновите страницу' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AiChatRequestBody | null;
  if (typeof body?.businessId !== 'string' || typeof body.message !== 'string') {
    return NextResponse.json({ message: 'Некорректный запрос' }, { status: 400 });
  }
  // Валидирует backend (`ChatRequestDto.attachmentIds`) — здесь только
  // отсекаем совсем не тот тип, чтобы не пробрасывать мусор дальше.
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((id): id is string => typeof id === 'string')
    : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/businesses/${body.businessId}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: body.message, attachmentIds }),
      // Стрим нельзя буферизовать целиком — иначе клиент получит все SSE-
      // фреймы одним куском только в конце хода, что убивает весь смысл AI-3.
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'Сервер недоступен, попробуйте позже' }, { status: 503 });
  }

  if (!upstream.ok || !upstream.body) {
    const errorBody = (await upstream.json().catch(() => null)) as { message?: unknown } | null;
    const message =
      typeof errorBody?.message === 'string'
        ? errorBody.message
        : Array.isArray(errorBody?.message)
          ? errorBody.message.join(', ')
          : 'Не удалось выполнить запрос к серверу';
    return NextResponse.json({ message }, { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
