'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getInitials } from '@/shared/lib/get-initials';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { SearchResult } from '../model/types';

interface SearchUserResponse {
  id: string;
  name: string;
  tagline: string;
  city: string | null;
}

interface SearchGroupResponse {
  id: string;
  name: string;
  meta: string;
  mark: string;
}

interface SearchCommunityResponse {
  id: string;
  name: string;
  about: string;
  cover: string;
  membersCount: number;
  isJoined: boolean;
}

interface SearchResponse {
  users: SearchUserResponse[];
  groups: SearchGroupResponse[];
  communities: SearchCommunityResponse[];
}

export async function search(query: string): Promise<SearchResult> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const result = await backendFetch<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, {
    token,
  });

  return {
    users: result.users.map((user) => ({
      id: user.id,
      name: user.name,
      initials: getInitials(user.name),
      tagline: user.tagline,
      city: user.city,
    })),
    groups: result.groups.map((group) => ({
      id: group.id,
      name: group.name,
      meta: group.meta,
      mark: group.mark,
    })),
    communities: result.communities.map((community) => ({
      id: community.id,
      name: community.name,
      about: community.about,
      members: `${community.membersCount} ${pluralizeRu(community.membersCount, ['человек', 'человека', 'человек'])} за столом`,
      isJoined: community.isJoined,
    })),
  };
}
