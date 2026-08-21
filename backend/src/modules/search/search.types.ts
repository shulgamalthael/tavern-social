import type { GroupType } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

/** Каталог групп публичен (включая приватные — по названию/описанию), как и
 * у сообществ (см. SearchCommunityDto) — вступление в приватную требует
 * заявки, что видно по `type`, а не скрывается из поиска. */
export interface SearchGroupDto {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  membersCount: number;
  isMember: boolean;
}

export interface SearchCommunityDto {
  id: string;
  name: string;
  about: string;
  cover: string;
  membersCount: number;
  isJoined: boolean;
}

export interface SearchResultDto {
  users: PublicProfile[];
  groups: SearchGroupDto[];
  communities: SearchCommunityDto[];
}
