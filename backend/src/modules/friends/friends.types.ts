import type { PublicProfile } from '@/modules/users/users.types';

export interface FriendDto {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string | null;
  city: string | null;
  about: string | null;
  tags: string[];
  isHere: boolean;
  friendsSince: string;
  mutualFriendsCount: number;
}

export interface FriendRequestDto {
  user: PublicProfile;
  createdAt: string;
}

export interface FriendRequestsListDto {
  incoming: FriendRequestDto[];
  outgoing: FriendRequestDto[];
}

export interface FriendshipStatusDto {
  isFriend: boolean;
  hasOutgoingRequest: boolean;
  hasIncomingRequest: boolean;
}

/** Что именно произошло — используется контроллером, чтобы решить, какое
 * (если вообще) real-time событие отправить, не расширяя REST-ответ. */
export interface SendRequestResult {
  status: FriendshipStatusDto;
  outcome: 'already-friends' | 'already-pending' | 'request-created' | 'auto-accepted';
}

export interface RespondToRequestResult {
  status: FriendshipStatusDto;
  removed: boolean;
}
