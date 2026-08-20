'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { UserProfile } from '../model/user-profile-types';

interface UserProfileResponse {
  id: string;
  name: string;
  tagline: string;
  city: string | null;
  about: string | null;
  tags: string[];
  friendship: {
    isFriend: boolean;
    hasOutgoingRequest: boolean;
    hasIncomingRequest: boolean;
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const user = await backendFetch<UserProfileResponse>(`/users/${userId}`, { token });

  return {
    id: user.id,
    name: user.name,
    initials: getInitials(user.name),
    tagline: user.tagline,
    city: user.city,
    about: user.about,
    tags: user.tags,
    isFriend: user.friendship.isFriend,
    hasOutgoingRequest: user.friendship.hasOutgoingRequest,
    hasIncomingRequest: user.friendship.hasIncomingRequest,
  };
}
