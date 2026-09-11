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

/** `followersCount`/`followingCount` НЕ отдаются здесь — та же причина, что
 * `friendship`/`subscription` не входят в `toPublicProfile`: это чистая
 * функция без обращения к БД (см. комментарий класса), а счётчики требуют
 * запроса к `Subscription`. Контроллер (`UsersController.me`) домешивает их
 * так же, как `getById` домешивает `friendship`/`subscription`. */
export function toMeProfile(
  user: User,
): Omit<MeProfile, 'followersCount' | 'followingCount' | 'friendsCount'> {
  return {
    ...toPublicProfile(user),
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    settings: {
      quietHours: user.quietHours,
      showPresence: user.showPresence,
      allowStrangerInvites: user.allowStrangerInvites,
      morningDigest: user.morningDigest,
      isPrivate: user.isPrivate,
    },
  };
}
