import type { UserRole } from '@prisma/client';
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
  /** Только для показа пункта «Админка» в навигации (см.
   * `entities/user/model/types.ts#CurrentUser.role` на frontend) — реальная
   * авторизация везде на `AdminGuard`, не на этом поле. */
  role: UserRole;
  /** Только для показа кнопки выдачи супер-прав в админке (см.
   * `entities/user/model/types.ts#CurrentUser.isSuperAdmin`) — реальная
   * авторизация на `SuperAdminGuard`, не на этом поле, тот же принцип,
   * что и у `role` выше. */
  isSuperAdmin: boolean;
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
