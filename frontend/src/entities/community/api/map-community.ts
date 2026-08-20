import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import type { Community } from '../model/types';

export interface CommunityResponse {
  id: string;
  name: string;
  about: string;
  cover: string;
  membersCount: number;
  isJoined: boolean;
}

export function mapCommunity(community: CommunityResponse): Community {
  return {
    id: community.id,
    name: community.name,
    about: community.about,
    cover: community.cover,
    members: `${community.membersCount} ${pluralizeRu(community.membersCount, ['человек', 'человека', 'человек'])} за столом`,
    isJoined: community.isJoined,
  };
}
