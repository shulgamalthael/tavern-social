import type { PublicProfile } from '@/modules/users/users.types';

/** Группа найдена среди групп, в которых текущий пользователь уже состоит —
 * группы закрытые, «только по приглашению» (см. GroupsService), поэтому
 * поиск не обещает то, чего нет: чужие группы не отдаются. */
export interface SearchGroupDto {
  id: string;
  name: string;
  meta: string;
  mark: string;
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
