import { getInitials } from '@/shared/lib/get-initials';
import { formatSinceDate } from '@/shared/lib/format-since-date';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import type { Friend } from '../model/types';

export interface FriendResponse {
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

export function mapFriend(friend: FriendResponse): Friend {
  return {
    id: friend.id,
    initials: getInitials(friend.name),
    avatarUrl: friend.avatarUrl,
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
