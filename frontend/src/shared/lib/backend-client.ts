import 'server-only';

/**
 * Базовый URL backend, доступный только на сервере (Server Actions/Components).
 * Браузер никогда не обращается к backend REST API напрямую — только через
 * этот модуль, вызываемый из серверного кода (см. AGENTS.md, раздел «Backend
 * ↔ Frontend»). Исключение — Socket.IO: для него используется отдельный
 * публичный `NEXT_PUBLIC_BACKEND_WS_URL` (см. `shared/config/realtime.ts`).
 */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

export class BackendError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

interface BackendErrorBody {
  message?: string | string[];
}

interface BackendRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
}

function extractErrorMessage(body: unknown): string {
  const typed = body as BackendErrorBody | null;
  if (!typed?.message) return 'Не удалось выполнить запрос к серверу';
  return Array.isArray(typed.message) ? typed.message.join(', ') : typed.message;
}

/**
 * Единая точка HTTP-вызовов к backend из серверного кода frontend. Бросает
 * `BackendError` с человекочитаемым сообщением на любую ошибку — вызывающий
 * код (Server Actions, store'ы через `try/catch`) уже умеет показывать его
 * через `ErrorState`/`AuthFormState`, ничего дополнительно оборачивать не нужно.
 */
export async function backendFetch<T>(
  path: string,
  options: BackendRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new BackendError('Сервер недоступен, попробуйте позже', 503);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new BackendError(extractErrorMessage(errorBody), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Как `backendFetch`, но для multipart-запросов (загрузка файлов) — тело
 * `FormData`, а не JSON. `Content-Type` намеренно не выставляется вручную:
 * `fetch` сам подставит `multipart/form-data; boundary=...` из объекта
 * `FormData`, а руками этот boundary не собрать.
 */
export async function backendUpload<T>(
  path: string,
  options: { token?: string | null; formData: FormData },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
      body: options.formData,
      cache: 'no-store',
    });
  } catch {
    throw new BackendError('Сервер недоступен, попробуйте позже', 503);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new BackendError(extractErrorMessage(errorBody), response.status);
  }

  return (await response.json()) as T;
}
