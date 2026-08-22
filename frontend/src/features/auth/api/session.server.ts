import 'server-only';
import { cache } from 'react';
import type { CurrentUser } from '@/entities/user';
import { BackendError, backendFetch } from '@/shared/lib/backend-client';
import { getInitials } from '@/shared/lib/get-initials';
import { getSessionToken } from '@/shared/lib/session-token.server';

interface MeProfileResponse {
  id: string;
  name: string;
  tagline: string;
  accent: string | null;
  about: string | null;
  city: string | null;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  role: 'user' | 'admin';
}

function toCurrentUser(profile: MeProfileResponse): CurrentUser {
  return {
    id: profile.id,
    name: profile.name,
    initials: getInitials(profile.name),
    tagline: profile.tagline,
    accent: profile.accent ?? undefined,
    about: profile.about,
    city: profile.city,
    tags: profile.tags,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    role: profile.role,
  };
}

/**
 * DAL: единственное место, которое резолвит сессию в профиль пользователя.
 * `cache()` мемоизирует результат на время одного рендер-прохода. Токен из
 * cookie сам по себе ничего не говорит о пользователе — backend является
 * единственным источником истины (Redis-сессия → профиль в PostgreSQL), см.
 * AGENTS.md, раздел про auth.
 */
export const getSessionUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;

  try {
    const profile = await backendFetch<MeProfileResponse>('/users/me', { token });
    return toCurrentUser(profile);
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) return null;
    // Backend недоступен или вернул неожиданную ошибку — не считаем это
    // «пользователь не вошёл», просто честно нет сессии для рендера страницы.
    return null;
  }
});
