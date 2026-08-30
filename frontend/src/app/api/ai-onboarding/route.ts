import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionToken } from '@/shared/lib/session-token.server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

interface AiOnboardingRequestBody {
  message?: unknown;
}

/**
 * Прокси-стрим `POST /ai/onboarding/chat` (`OnboardingController`, AI-4, см.
 * AI_PLATFORM_ROADMAP.md §2.7) — тот же приём, что у `app/api/ai-chat/route.ts`
 * (её комментарий объясняет, почему нужен именно Route Handler, а не Server
 * Action, для постепенно читаемого SSE-тела). Единственное отличие от неё —
 * в теле запроса нет `businessId`: онбординг-диалог существует ДО того, как
 * какой-либо бизнес создан, backend-маршрут не вложен под `businesses/:id`.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Сессия истекла — обновите страницу' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AiOnboardingRequestBody | null;
  if (typeof body?.message !== 'string') {
    return NextResponse.json({ message: 'Некорректный запрос' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/ai/onboarding/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: body.message }),
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
