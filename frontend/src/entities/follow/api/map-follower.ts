import { getInitials } from '@/shared/lib/get-initials';
import type { Follower } from '../model/types';

export interface FollowerResponse {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string | null;
  city: string | null;
  subscribedAt: string;
}

export function mapFollower(follower: FollowerResponse): Follower {
  return {
    id: follower.id,
    initials: getInitials(follower.name),
    avatarUrl: follower.avatarUrl,
    name: follower.name,
    tagline: follower.tagline,
    city: follower.city,
    followedAt: follower.subscribedAt,
  };
}
