export interface SearchUserResult {
  id: string;
  name: string;
  initials: string;
  tagline: string;
  city: string | null;
}

export interface SearchGroupResult {
  id: string;
  name: string;
  meta: string;
  mark: string;
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
