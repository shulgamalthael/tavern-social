import type { User } from '@prisma/client';
import type { MeProfile, PublicProfile } from './users.types';

/**
 * Чистые функции без зависимостей — вынесены из `UsersService`, чтобы другие
 * модули (например `FriendsService`) могли строить `PublicProfile` без
 * необходимости импортировать `UsersModule` (и тем самым не создавать
 * циклическую зависимость модулей, если `UsersModule` сам когда-нибудь
 * импортирует что-то из этих модулей).
 */
export function toPublicProfile(user: User): PublicProfile {
  return {
    id: user.id,
    name: user.name,
    tagline: user.tagline,
    accent: user.accent,
    city: user.city,
    about: user.about,
    tags: user.tags,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
  };
}

export function toMeProfile(user: User): MeProfile {
  return {
    ...toPublicProfile(user),
    email: user.email,
    settings: {
      quietHours: user.quietHours,
      showPresence: user.showPresence,
      allowStrangerInvites: user.allowStrangerInvites,
      morningDigest: user.morningDigest,
    },
  };
}
