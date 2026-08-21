export interface SearchUserResult {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  tagline: string;
  city: string | null;
}

export interface SearchGroupResult {
  id: string;
  name: string;
  description: string;
  type: 'open' | 'private';
  avatarUrl: string | null;
  membersCount: number;
  isMember: boolean;
}

export interface SearchCommunityResult {
  id: string;
  name: string;
  about: string;
  members: string;
  isJoined: boolean;
}

export interface SearchResult {
  users: SearchUserResult[];
  groups: SearchGroupResult[];
  communities: SearchCommunityResult[];
}
