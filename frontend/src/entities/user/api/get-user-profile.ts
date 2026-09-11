'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { UserRole } from '../model/types';
import type {
  UserProfile,
  UserProfileBusiness,
  UserProfileCreatorStatus,
} from '../model/user-profile-types';

interface UserProfileResponse {
  id: string;
  name: string;
  role: UserRole;
  tagline: string;
  city: string | null;
  about: string | null;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  friendship: {
    isFriend: boolean;
    hasOutgoingRequest: boolean;
    hasIncomingRequest: boolean;
  };
  subscription: {
    isFollowing: boolean;
    hasPendingRequest: boolean;
  };
  isPrivate: boolean;
  canViewFullProfile: boolean;
  followersCount: number;
  followingCount: number;
  creatorStatus: UserProfileCreatorStatus | null;
  friendsCount: number;
  businesses: UserProfileBusiness[];
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const user = await backendFetch<UserProfileResponse>(`/users/${userId}`, { token });

  return {
    id: user.id,
    name: user.name,
    role: user.role,
    initials: getInitials(user.name),
    tagline: user.tagline,
    city: user.city,
    about: user.about,
    tags: user.tags,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    isFriend: user.friendship.isFriend,
    hasOutgoingRequest: user.friendship.hasOutgoingRequest,
    hasIncomingRequest: user.friendship.hasIncomingRequest,
    isFollowing: user.subscription.isFollowing,
    hasPendingSubscriptionRequest: user.subscription.hasPendingRequest,
    isPrivate: user.isPrivate,
    canViewFullProfile: user.canViewFullProfile,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    creatorStatus: user.creatorStatus,
    friendsCount: user.friendsCount,
    businesses: user.businesses,
  };
}
