'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getInitials } from '@/shared/lib/get-initials';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { EditableProfile } from '../model/types';

export interface UpdateProfileInput {
  name: string;
  tagline: string;
  about: string;
  city: string;
  tags: string[];
}

interface MeProfileResponse {
  name: string;
  tagline: string;
  about: string | null;
  city: string | null;
  tags: string[];
}

/**
 * Патчит `PATCH /users/me` — тот же endpoint, что и форма в `SettingsWidget`
 * (`features/auth`'s `updateProfile` Server Action), но как обычная async-
 * функция для инлайн-редактирования на странице профиля
 * (`features/edit-profile`), а не `useActionState`+`FormData`. Не может
 * переиспользовать action из `features/auth` напрямую — FSD запрещает
 * импорт «вбок» между слайсами одного слоя фич.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<EditableProfile> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const profile = await backendFetch<MeProfileResponse>('/users/me', {
    method: 'PATCH',
    token,
    body: input,
  });

  return {
    name: profile.name,
    initials: getInitials(profile.name),
    tagline: profile.tagline,
    about: profile.about,
    city: profile.city,
    tags: profile.tags,
  };
}
