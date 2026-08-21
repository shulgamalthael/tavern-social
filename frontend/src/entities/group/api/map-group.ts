import { getInitials } from '@/shared/lib/get-initials';
import type {
  Group,
  GroupJoinRequest,
  GroupMember,
  GroupMemberUser,
  GroupRole,
  GroupType,
} from '../model/types';

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  currentUserRole: GroupRole | null;
  hasPendingJoinRequest: boolean;
  canViewContent: boolean;
}

export function mapGroup(group: GroupResponse): Group {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    type: group.type,
    avatarUrl: group.avatarUrl,
    coverUrl: group.coverUrl,
    membersCount: group.membersCount,
    currentUserRole: group.currentUserRole,
    hasPendingJoinRequest: group.hasPendingJoinRequest,
    canViewContent: group.canViewContent,
  };
}

export interface GroupMemberUserResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface GroupMemberResponse {
  user: GroupMemberUserResponse;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupJoinRequestResponse {
  user: GroupMemberUserResponse;
  createdAt: string;
}

function mapGroupMemberUser(user: GroupMemberUserResponse): GroupMemberUser {
  return {
    id: user.id,
    name: user.name,
    initials: getInitials(user.name),
    avatarUrl: user.avatarUrl,
  };
}

export function mapGroupMember(member: GroupMemberResponse): GroupMember {
  return { user: mapGroupMemberUser(member.user), role: member.role, joinedAt: member.joinedAt };
}

export function mapGroupJoinRequest(request: GroupJoinRequestResponse): GroupJoinRequest {
  return { user: mapGroupMemberUser(request.user), createdAt: request.createdAt };
}
