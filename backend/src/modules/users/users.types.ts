import type { CreatorStatus, UserRole } from '@prisma/client';
import type { FriendshipStatusDto } from '@/modules/friends/friends.types';
import type { SubscriptionStatusDto } from '@/modules/subscriptions/subscriptions.types';

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
    isPrivate: boolean;
  };
  /** Реальная аудитория (§85, `Subscription`) — не то же самое, что друзья.
   * Считается на каждый запрос `/users/me`, не кэшируется — тот же
   * "не хранить производное" принцип, что и у `CreatorEligibilityDto`. */
  followersCount: number;
  followingCount: number;
  /** Общее число друзей — не то же самое, что длина списка из
   * `GET /users/:id/friends` (тот обрезан `MAX_PAGINATION_LIMIT`). Отдельный
   * `count()`, не `findMany().length`, тот же приём, что и у `followersCount`. */
  friendsCount: number;
}

/** Опубликованный бизнес чужого пользователя — только то, что нужно для
 * ссылки на его публичный сайт (`/site/{id}`) в бейдже «владелец бизнеса»
 * на чужой странице профиля. Не переиспользует `BusinessDto` целиком
 * (`modules/businesses/businesses.types.ts`) — тому чужому посетителю не
 * нужны ни адрес, ни соцсети, ни настройки монетизации владельца. */
export interface PublicBusinessDto {
  id: string;
  name: string;
}

/** Профиль чужого пользователя (`GET /users/:id`) — публичные поля плюс
 * статус дружбы/подписки относительно текущего пользователя и счётчики
 * его аудитории (§85). */
export interface UserProfileDto extends PublicProfile {
  /** Только для бейджа «Админ» на чужой странице профиля (см. `widgets/
   * profile/ui/ProfileBadges.tsx` на frontend) — не авторизация, та по-
   * прежнему только на `AdminGuard`, тот же принцип, что и у `MeProfile.role`
   * выше. */
  role: UserRole;
  friendship: FriendshipStatusDto;
  subscription: SubscriptionStatusDto;
  /// Приватная страница (§103) — верхний блок (это поле, `name`/`tagline`/
  /// `avatarUrl`/`coverUrl` из `PublicProfile`, и счётчики ниже) виден
  /// всегда; about/tags/creatorStatus/businesses в этом DTO читаются только
  /// когда `canViewFullProfile`, иначе нулевые/пустые значения (см.
  /// `UsersController.getById`).
  isPrivate: boolean;
  /** Друг, одобренный подписчик, сам владелец или админ (см.
   * `UsersService.canViewRestrictedContent`) — frontend прячет стену/фото/
   * списки друзей и подписчиков, когда `false`, но не сами счётчики ниже
   * (те видны и без доступа, некликабельными числами — по просьбе продукта). */
  canViewFullProfile: boolean;
  /** Видны даже без `canViewFullProfile` (некликабельными числами на
   * frontend) — сами списки за ними (`GET /users/:id/followers`/
   * `/following`/`/friends`) по-прежнему требуют полного доступа. */
  followersCount: number;
  followingCount: number;
  /** `null` — нет `CreatorProfile` вообще (не путать с `verification_pending`
   * — это уже начатый онбординг). Используется `CreatorBar` (`widgets/
   * creator-bar`) на чужой странице профиля — виден любому посетителю, но
   * только когда `active` (только тогда — реальный, а не ещё не
   * подтверждённый Creator), см. `HomeApp`'s комментарий. */
  creatorStatus: CreatorStatus | null;
  friendsCount: number;
  /** Только ОПУБЛИКОВАННЫЕ бизнесы — черновик ещё не готов, ссылка на его
   * публичный сайт вела бы постороннего посетителя в пустоту. Пустой
   * массив — бейдж «владелец бизнеса» просто не рендерится (см.
   * `ProfileBadges.tsx`). */
  businesses: PublicBusinessDto[];
}
