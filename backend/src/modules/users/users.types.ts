import type { FriendshipStatusDto } from '@/modules/friends/friends.types';

/** Публичный профиль — то, что видно другим пользователям (посты, друзья, участники). */
export interface PublicProfile {
  id: string;
  name: string;
  tagline: string;
  accent: string | null;
  city: string | null;
  about: string | null;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
}

/** Профиль текущего пользователя — включает приватные поля (email, настройки). */
export interface MeProfile extends PublicProfile {
  email: string;
  settings: {
    quietHours: boolean;
    showPresence: boolean;
    allowStrangerInvites: boolean;
    morningDigest: boolean;
  };
}

/** Профиль чужого пользователя (`GET /users/:id`) — публичные поля плюс
 * статус дружбы относительно текущего пользователя. */
export interface UserProfileDto extends PublicProfile {
  friendship: FriendshipStatusDto;
}
