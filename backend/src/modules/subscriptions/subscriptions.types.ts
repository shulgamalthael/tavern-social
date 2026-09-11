import type { PublicProfile } from '@/modules/users/users.types';

export interface SubscriptionStatusDto {
  isFollowing: boolean;
  /** Моя исходящая заявка на подписку к этому пользователю ещё не одобрена
   * (§103, `SubscriptionRequest`) — только для приватных профилей, у
   * публичных подписка мгновенна и это поле всегда `false`. */
  hasPendingRequest: boolean;
}

/** Что именно произошло при `POST /subscriptions/:userId` — тот же приём,
 * что `SendRequestResult.outcome` у `FriendsService`, используется
 * контроллером, чтобы решить, какое (если вообще) real-time событие
 * отправить. */
export type SubscribeOutcome = 'followed' | 'already-following' | 'requested' | 'already-requested';

export interface SubscribeResult {
  status: SubscriptionStatusDto;
  outcome: SubscribeOutcome;
}

export interface SubscriptionRequestDto {
  user: PublicProfile;
  createdAt: string;
}

export interface SubscriptionRequestsListDto {
  incoming: SubscriptionRequestDto[];
  outgoing: SubscriptionRequestDto[];
}

/** Одна строка списка подписчиков/подписок — тот же плоский набор полей,
 * что `FriendDto` (`modules/friends/friends.types.ts`), без `isHere`/
 * `mutualFriendsCount`: presence и «общие друзья» не имеют смысла для
 * одностороннего отношения. `initials` не отдаётся — фронтенд считает его
 * сам из `name`, тот же приём, что и у `FriendDto`/`PublicProfile`. */
export interface SubscriberDto {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string | null;
  city: string | null;
  subscribedAt: string;
}
