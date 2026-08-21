export type GroupType = 'open' | 'private';
export type GroupRole = 'owner' | 'member';

export interface Group {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  /** `null` — не участник. */
  currentUserRole: GroupRole | null;
  hasPendingJoinRequest: boolean;
  /** `true` — открытая группа либо текущий пользователь уже участник: можно
   * показывать ленту/участников. `false` — вместо них CTA «Отправить запрос»
   * (backend проверяет доступ сам, это поле — только подсказка для UI). */
  canViewContent: boolean;
}

export interface GroupMemberUser {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export interface GroupMember {
  user: GroupMemberUser;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupJoinRequest {
  user: GroupMemberUser;
  createdAt: string;
}
