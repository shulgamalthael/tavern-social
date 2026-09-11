import type { UserRole } from './types';

/** Зеркало backend's `CreatorStatus` (`@prisma/client`) — не импортируется из
 * `entities/creator` напрямую (тот же слой FSD, боковые импорты запрещены),
 * своя независимая копия, тот же приём, что и у остальных enum-зеркал между
 * слайсами. */
export type UserProfileCreatorStatus =
  'verification_pending' | 'verified' | 'active' | 'rejected' | 'suspended';

/** Опубликованный бизнес чужого пользователя — только то, что нужно
 * бейджу «владелец бизнеса» (`widgets/profile/ui/ProfileBadges.tsx`), чтобы
 * сослаться на его публичный сайт (`/site/{id}`). Не переиспользует
 * `Business` из `entities/business` (боковой импорт между слайсами одного
 * слоя запрещён, тот же принцип, что и у `UserProfileCreatorStatus` выше) —
 * это и есть тот случай, где нужен независимый минимальный тип. */
export interface UserProfileBusiness {
  id: string;
  name: string;
}

/** Профиль чужого пользователя — в отличие от `CurrentUser`, несёт статус
 * дружбы относительно текущего пользователя (для кнопок на его странице). */
export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  /** Только для бейджа «Админ» на чужой странице профиля (`ProfileBadges`)
   * — не авторизация, та по-прежнему только на защите маршрутов backend'а,
   * тот же принцип, что и у `CurrentUser.role`. */
  role: UserRole;
  tagline: string;
  city: string | null;
  about: string | null;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  isFriend: boolean;
  hasOutgoingRequest: boolean;
  hasIncomingRequest: boolean;
  /** Односторонняя подписка (`entities/follow`) — независима от дружбы выше,
   * оба показываются одновременно, не взаимоисключающе. */
  isFollowing: boolean;
  /** Моя исходящая заявка на подписку к этому пользователю ещё не одобрена
   * — только у приватных профилей (`isPrivate`), у публичных `subscribe`
   * мгновенен и это поле всегда `false`. */
  hasPendingSubscriptionRequest: boolean;
  /** Приватная страница — весь контент, кроме верхнего блока (обложка/
   * аватар/имя/тэглайн), виден только друзьям и одобренным подписчикам (см.
   * `canViewFullProfile` ниже). */
  isPrivate: boolean;
  /** Друг, одобренный подписчик, сам владелец или админ — `false` прячет
   * всё, кроме верхнего блока (`UserProfileView`'s `LockedState`). */
  canViewFullProfile: boolean;
  followersCount: number;
  followingCount: number;
  /** `null` — нет `CreatorProfile` вообще. `widgets/creator-bar` показывает
   * плашку любому посетителю этой страницы только при `'active'`. */
  creatorStatus: UserProfileCreatorStatus | null;
  /** Общее число друзей — не то же самое, что длина списка друзей на
   * странице профиля (тот обрезан, см. `ProfileFriendsCard`). */
  friendsCount: number;
  /** Только опубликованные — бейдж «владелец бизнеса» на чужой странице
   * профиля не рендерится вовсе, если пусто (см. `ProfileBadges.tsx`). */
  businesses: UserProfileBusiness[];
}
