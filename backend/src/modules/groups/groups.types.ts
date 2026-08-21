import type { GroupRole, GroupType } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  /** `null` — не участник. */
  currentUserRole: GroupRole | null;
  /** Заявка на вступление уже отправлена и ждёт решения владельца (только
   * имеет смысл для `type === 'private'`, для `open`-групп всегда `false`). */
  hasPendingJoinRequest: boolean;
  /** `true`, если группа открытая либо текущий пользователь уже участник —
   * frontend по этому флагу решает, показывать ленту/участников или CTA
   * «Отправить запрос» вместо них. Backend проверяет доступ к контенту
   * самостоятельно (см. GroupsService/PostsService), это поле — только
   * подсказка для UI, не единственный рубеж защиты. */
  canViewContent: boolean;
}

export interface GroupMemberDto {
  user: PublicProfile;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupJoinRequestDto {
  user: PublicProfile;
  createdAt: string;
}
