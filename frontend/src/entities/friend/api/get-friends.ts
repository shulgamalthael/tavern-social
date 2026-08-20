'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { formatSinceDate } from '@/shared/lib/format-since-date';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Friend } from '../model/types';

interface FriendResponse {
  id: string;
  name: string;
  tagline: string;
  city: string | null;
  about: string | null;
  tags: string[];
  isHere: boolean;
  friendsSince: string;
  mutualFriendsCount: number;
}

function mapFriend(friend: FriendResponse): Friend {
  return {
    id: friend.id,
    initials: getInitials(friend.name),
    name: friend.name,
    note: friend.tagline,
    city: friend.city ?? '',
    here: friend.isHere,
    status: friend.isHere ? 'здесь' : 'не в сети',
    since: formatSinceDate(friend.friendsSince),
    mutual: `${friend.mutualFriendsCount} ${pluralizeRu(friend.mutualFriendsCount, ['общий друг', 'общих друга', 'общих друзей'])}`,
    tags: friend.tags,
    about: friend.about ?? '',
  };
}

export async function getFriends(): Promise<Friend[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const friends = await backendFetch<FriendResponse[]>('/friends', { token });
  return friends.map(mapFriend);
}
