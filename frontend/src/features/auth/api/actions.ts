'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { EditableProfile } from '@/entities/user';
import { BackendError, backendFetch } from '@/shared/lib/backend-client';
import { getInitials } from '@/shared/lib/get-initials';
import { SESSION_COOKIE_NAME } from '@/shared/config/session';
import { getSessionToken } from '@/shared/lib/session-token.server';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

interface AuthSessionResponse {
  token: string;
}

async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

function readField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

export interface AuthFormState {
  error?: string;
}

/** Форма регистрации: заводит аккаунт в backend и открывает сессию. */
export async function registerAccount(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = readField(formData, 'name');
  const email = readField(formData, 'email');
  const password = readField(formData, 'password');

  try {
    const session = await backendFetch<AuthSessionResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    await setSessionCookie(session.token);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : 'Не удалось создать аккаунт' };
  }

  redirect('/');
}

/** Форма входа: проверяет пароль в backend и открывает сессию. */
export async function loginToAccount(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, 'email');
  const password = readField(formData, 'password');

  try {
    const session = await backendFetch<AuthSessionResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await setSessionCookie(session.token);
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : 'Не удалось войти' };
  }

  redirect('/');
}

export async function endSession(): Promise<void> {
  const token = await getSessionToken();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  if (token) {
    // Отзываем сессию в backend (Redis) — не только чистим cookie. Ошибку
    // игнорируем: пользователь в любом случае выходит на клиенте.
    await backendFetch('/auth/logout', { method: 'POST', token }).catch(() => undefined);
  }

  redirect('/auth');
}

export interface UpdateProfileState {
  error?: string;
  user?: EditableProfile;
}

/** Сохраняет имя/подпись — вызывается из формы настроек. */
export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const token = await getSessionToken();
  if (!token) {
    redirect('/auth');
  }

  const name = readField(formData, 'name');
  const tagline = readField(formData, 'tagline');

  try {
    const profile = await backendFetch<{ name: string; tagline: string }>('/users/me', {
      method: 'PATCH',
      token,
      body: { name, tagline },
    });
    return {
      user: { name: profile.name, initials: getInitials(profile.name), tagline: profile.tagline },
    };
  } catch (error) {
    return {
      error: error instanceof BackendError ? error.message : 'Не удалось сохранить профиль',
    };
  }
}

export interface UpdateSettingsInput {
  quietHours: boolean;
  showPresence: boolean;
  allowStrangerInvites: boolean;
  morningDigest: boolean;
}

/** Сохраняет тумблеры приватности из «Настроек» — see widgets/settings. */
export async function updateSettings(input: UpdateSettingsInput): Promise<void> {
  const token = await getSessionToken();
  if (!token) redirect('/auth');

  await backendFetch('/users/me/settings', { method: 'PATCH', token, body: input });
}

/**
 * Одноразовый короткоживущий билет для подключения браузера к Socket.IO —
 * основной session-токен клиентскому JS никогда не передаётся (см.
 * PROJECT_CONTEXT.md, раздел «Real-time»).
 */
export async function getSocketTicket(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const { ticket } = await backendFetch<{ ticket: string }>('/auth/socket-ticket', {
      method: 'POST',
      token,
    });
    return ticket;
  } catch {
    return null;
  }
}
