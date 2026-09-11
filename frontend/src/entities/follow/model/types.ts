/** Односторонняя подписка — сознательно отдельная сущность от `Friend`
 * (`entities/friend`): без presence/"общих друзей" (не имеют смысла для
 * одностороннего отношения). Для публичного профиля по-прежнему без
 * заявки/подтверждения; для приватного `subscribe` заводит заявку — см.
 * `hasPendingRequest` у `FollowStatus` и `follow-requests-store.ts`. Названо
 * `follow`, не `subscription` — то имя уже занято другой, не связанной
 * сущностью (`entities/subscription` — тариф оплаты бизнеса). См. backend
 * `Subscription`'s комментарий в schema.prisma. */
export interface Follower {
  id: string;
  initials: string;
  avatarUrl: string | null;
  name: string;
  tagline: string;
  city: string | null;
  followedAt: string;
}

export interface FollowersPage {
  items: Follower[];
  nextCursor: string | null;
}

export interface FollowStatus {
  isFollowing: boolean;
  /** Моя исходящая заявка на подписку ещё не одобрена — только для
   * приватных профилей, см. модели `SubscriptionRequest`. */
  hasPendingRequest: boolean;
}

/** Заявка на подписку — тот же превью-набор полей, что у
 * `entities/friend`'s `FriendRequestPreview`, только для одностороннего
 * отношения. */
export interface SubscriptionRequestPreview {
  id: string;
  initials: string;
  avatarUrl: string | null;
  name: string;
  tagline: string;
  city: string | null;
  sentAt: string;
}
