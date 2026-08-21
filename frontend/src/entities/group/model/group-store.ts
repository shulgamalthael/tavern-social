import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { approveGroupJoinRequest } from '../api/approve-group-join-request';
import { createGroup as createGroupAction, type CreateGroupInput } from '../api/create-group';
import { getGroup } from '../api/get-group';
import { getGroupJoinRequests } from '../api/get-group-join-requests';
import { getGroupMembers } from '../api/get-group-members';
import { getGroups } from '../api/get-groups';
import { joinGroup as joinGroupAction } from '../api/join-group';
import { leaveGroup as leaveGroupAction } from '../api/leave-group';
import { rejectGroupJoinRequest } from '../api/reject-group-join-request';
import { removeGroupMember as removeGroupMemberAction } from '../api/remove-group-member';
import { requestGroupJoin as requestGroupJoinAction } from '../api/request-group-join';
import { updateGroup as updateGroupAction, type UpdateGroupInput } from '../api/update-group';
import { uploadGroupImage } from '../api/upload-group-image';
import type { Group, GroupJoinRequest, GroupMember } from './types';

interface GroupState {
  groups: Group[];
  status: AsyncStatus;
  error: string | null;
  nextCursor: string | null;
  loadMoreStatus: AsyncStatus;

  /** Данные конкретной группы (страница группы) — отдельно от каталога, тот
   * же принцип, что и `wallPostsByUserId` в `usePostStore` (см. AGENTS.md §4). */
  groupsById: Record<string, Group>;
  groupStatusById: Record<string, AsyncStatus>;
  groupErrorById: Record<string, string | null>;

  membersByGroupId: Record<string, GroupMember[]>;
  membersStatusByGroupId: Record<string, AsyncStatus>;
  membersErrorByGroupId: Record<string, string | null>;
  membersNextCursorByGroupId: Record<string, string | null>;
  membersLoadMoreStatusByGroupId: Record<string, AsyncStatus>;

  joinRequestsByGroupId: Record<string, GroupJoinRequest[]>;
  joinRequestsStatusByGroupId: Record<string, AsyncStatus>;
  joinRequestsErrorByGroupId: Record<string, string | null>;
  joinRequestsNextCursorByGroupId: Record<string, string | null>;
  joinRequestsLoadMoreStatusByGroupId: Record<string, AsyncStatus>;
}

interface GroupActions {
  loadGroups: () => Promise<void>;
  loadMoreGroups: () => Promise<void>;
  loadGroup: (groupId: string) => Promise<void>;
  createGroup: (input: CreateGroupInput) => Promise<Group>;
  updateGroup: (groupId: string, input: UpdateGroupInput) => Promise<Group>;
  uploadGroupAvatar: (groupId: string, file: Blob) => Promise<void>;
  uploadGroupCover: (groupId: string, file: Blob) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  requestGroupJoin: (groupId: string) => Promise<void>;
  loadJoinRequests: (groupId: string) => Promise<void>;
  loadMoreJoinRequests: (groupId: string) => Promise<void>;
  approveJoinRequest: (groupId: string, userId: string) => Promise<void>;
  rejectJoinRequest: (groupId: string, userId: string) => Promise<void>;
  loadMembers: (groupId: string) => Promise<void>;
  loadMoreMembers: (groupId: string) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
}

export type GroupStore = GroupState & GroupActions;

/** Патчит группу и в каталоге (если уже загружен), и в `groupsById` (если
 * уже открывали её страницу) — тот же приём, что `mapEverywhere` в
 * `post-store.ts`, но без отдельной функции: точек применения всего две. */
function applyGroup(state: GroupState, group: Group): Pick<GroupState, 'groups' | 'groupsById'> {
  return {
    groups: state.groups.map((existing) => (existing.id === group.id ? group : existing)),
    groupsById: { ...state.groupsById, [group.id]: group },
  };
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  status: 'idle',
  error: null,
  nextCursor: null,
  loadMoreStatus: 'idle',
  groupsById: {},
  groupStatusById: {},
  groupErrorById: {},
  membersByGroupId: {},
  membersStatusByGroupId: {},
  membersErrorByGroupId: {},
  membersNextCursorByGroupId: {},
  membersLoadMoreStatusByGroupId: {},
  joinRequestsByGroupId: {},
  joinRequestsStatusByGroupId: {},
  joinRequestsErrorByGroupId: {},
  joinRequestsNextCursorByGroupId: {},
  joinRequestsLoadMoreStatusByGroupId: {},

  loadGroups: async () => {
    set({ status: 'loading', error: null });
    try {
      const { groups, nextCursor } = await getGroups();
      set({ groups, nextCursor, status: 'success', loadMoreStatus: 'idle' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить группы',
      });
    }
  },
  loadMoreGroups: async () => {
    const { nextCursor, loadMoreStatus, status } = get();
    if (!nextCursor || loadMoreStatus === 'loading' || status !== 'success') return;

    set({ loadMoreStatus: 'loading' });
    try {
      const { groups, nextCursor: newCursor } = await getGroups(nextCursor);
      set((state) => ({
        groups: [...state.groups, ...groups],
        nextCursor: newCursor,
        loadMoreStatus: 'success',
      }));
    } catch {
      set({ loadMoreStatus: 'error' });
    }
  },
  loadGroup: async (groupId) => {
    set((state) => ({
      groupStatusById: { ...state.groupStatusById, [groupId]: 'loading' },
      groupErrorById: { ...state.groupErrorById, [groupId]: null },
    }));
    try {
      const group = await getGroup(groupId);
      set((state) => ({
        groupsById: { ...state.groupsById, [groupId]: group },
        groupStatusById: { ...state.groupStatusById, [groupId]: 'success' },
      }));
    } catch (error) {
      set((state) => ({
        groupStatusById: { ...state.groupStatusById, [groupId]: 'error' },
        groupErrorById: {
          ...state.groupErrorById,
          [groupId]: error instanceof Error ? error.message : 'Не удалось загрузить группу',
        },
      }));
    }
  },
  createGroup: async (input) => {
    const group = await createGroupAction(input);
    set((state) => ({
      groups: [group, ...state.groups],
      groupsById: { ...state.groupsById, [group.id]: group },
    }));
    return group;
  },
  updateGroup: async (groupId, input) => {
    const group = await updateGroupAction(groupId, input);
    set((state) => applyGroup(state, group));
    return group;
  },
  uploadGroupAvatar: async (groupId, file) => {
    const group = await uploadGroupImage(groupId, 'avatar', file);
    set((state) => applyGroup(state, group));
  },
  uploadGroupCover: async (groupId, file) => {
    const group = await uploadGroupImage(groupId, 'cover', file);
    set((state) => applyGroup(state, group));
  },
  joinGroup: async (groupId) => {
    const group = await joinGroupAction(groupId);
    set((state) => applyGroup(state, group));
  },
  leaveGroup: async (groupId) => {
    const group = await leaveGroupAction(groupId);
    set((state) => applyGroup(state, group));
  },
  requestGroupJoin: async (groupId) => {
    const group = await requestGroupJoinAction(groupId);
    set((state) => applyGroup(state, group));
  },
  loadJoinRequests: async (groupId) => {
    set((state) => ({
      joinRequestsStatusByGroupId: { ...state.joinRequestsStatusByGroupId, [groupId]: 'loading' },
      joinRequestsErrorByGroupId: { ...state.joinRequestsErrorByGroupId, [groupId]: null },
    }));
    try {
      const { requests, nextCursor } = await getGroupJoinRequests(groupId);
      set((state) => ({
        joinRequestsByGroupId: { ...state.joinRequestsByGroupId, [groupId]: requests },
        joinRequestsNextCursorByGroupId: {
          ...state.joinRequestsNextCursorByGroupId,
          [groupId]: nextCursor,
        },
        joinRequestsLoadMoreStatusByGroupId: {
          ...state.joinRequestsLoadMoreStatusByGroupId,
          [groupId]: 'idle',
        },
        joinRequestsStatusByGroupId: { ...state.joinRequestsStatusByGroupId, [groupId]: 'success' },
      }));
    } catch (error) {
      set((state) => ({
        joinRequestsStatusByGroupId: { ...state.joinRequestsStatusByGroupId, [groupId]: 'error' },
        joinRequestsErrorByGroupId: {
          ...state.joinRequestsErrorByGroupId,
          [groupId]: error instanceof Error ? error.message : 'Не удалось загрузить заявки',
        },
      }));
    }
  },
  loadMoreJoinRequests: async (groupId) => {
    const {
      joinRequestsNextCursorByGroupId,
      joinRequestsLoadMoreStatusByGroupId,
      joinRequestsStatusByGroupId,
    } = get();
    const cursor = joinRequestsNextCursorByGroupId[groupId];
    if (
      !cursor ||
      joinRequestsLoadMoreStatusByGroupId[groupId] === 'loading' ||
      joinRequestsStatusByGroupId[groupId] !== 'success'
    ) {
      return;
    }

    set((state) => ({
      joinRequestsLoadMoreStatusByGroupId: {
        ...state.joinRequestsLoadMoreStatusByGroupId,
        [groupId]: 'loading',
      },
    }));
    try {
      const { requests, nextCursor } = await getGroupJoinRequests(groupId, cursor);
      set((state) => ({
        joinRequestsByGroupId: {
          ...state.joinRequestsByGroupId,
          [groupId]: [...(state.joinRequestsByGroupId[groupId] ?? []), ...requests],
        },
        joinRequestsNextCursorByGroupId: {
          ...state.joinRequestsNextCursorByGroupId,
          [groupId]: nextCursor,
        },
        joinRequestsLoadMoreStatusByGroupId: {
          ...state.joinRequestsLoadMoreStatusByGroupId,
          [groupId]: 'success',
        },
      }));
    } catch {
      set((state) => ({
        joinRequestsLoadMoreStatusByGroupId: {
          ...state.joinRequestsLoadMoreStatusByGroupId,
          [groupId]: 'error',
        },
      }));
    }
  },
  approveJoinRequest: async (groupId, userId) => {
    const group = await approveGroupJoinRequest(groupId, userId);
    set((state) => ({
      ...applyGroup(state, group),
      joinRequestsByGroupId: {
        ...state.joinRequestsByGroupId,
        [groupId]: (state.joinRequestsByGroupId[groupId] ?? []).filter(
          (request) => request.user.id !== userId,
        ),
      },
      // Одобренная заявка становится членством — сброс уже загруженного
      // списка участников заставляет его перечитаться при следующем открытии
      // (проще, чем вручную вставлять новую строку в правильном порядке).
      membersStatusByGroupId: { ...state.membersStatusByGroupId, [groupId]: 'idle' },
    }));
  },
  rejectJoinRequest: async (groupId, userId) => {
    await rejectGroupJoinRequest(groupId, userId);
    set((state) => ({
      joinRequestsByGroupId: {
        ...state.joinRequestsByGroupId,
        [groupId]: (state.joinRequestsByGroupId[groupId] ?? []).filter(
          (request) => request.user.id !== userId,
        ),
      },
    }));
  },
  loadMembers: async (groupId) => {
    set((state) => ({
      membersStatusByGroupId: { ...state.membersStatusByGroupId, [groupId]: 'loading' },
      membersErrorByGroupId: { ...state.membersErrorByGroupId, [groupId]: null },
    }));
    try {
      const { members, nextCursor } = await getGroupMembers(groupId);
      set((state) => ({
        membersByGroupId: { ...state.membersByGroupId, [groupId]: members },
        membersNextCursorByGroupId: { ...state.membersNextCursorByGroupId, [groupId]: nextCursor },
        membersLoadMoreStatusByGroupId: {
          ...state.membersLoadMoreStatusByGroupId,
          [groupId]: 'idle',
        },
        membersStatusByGroupId: { ...state.membersStatusByGroupId, [groupId]: 'success' },
      }));
    } catch (error) {
      set((state) => ({
        membersStatusByGroupId: { ...state.membersStatusByGroupId, [groupId]: 'error' },
        membersErrorByGroupId: {
          ...state.membersErrorByGroupId,
          [groupId]: error instanceof Error ? error.message : 'Не удалось загрузить участников',
        },
      }));
    }
  },
  loadMoreMembers: async (groupId) => {
    const { membersNextCursorByGroupId, membersLoadMoreStatusByGroupId, membersStatusByGroupId } =
      get();
    const cursor = membersNextCursorByGroupId[groupId];
    if (
      !cursor ||
      membersLoadMoreStatusByGroupId[groupId] === 'loading' ||
      membersStatusByGroupId[groupId] !== 'success'
    ) {
      return;
    }

    set((state) => ({
      membersLoadMoreStatusByGroupId: {
        ...state.membersLoadMoreStatusByGroupId,
        [groupId]: 'loading',
      },
    }));
    try {
      const { members, nextCursor } = await getGroupMembers(groupId, cursor);
      set((state) => ({
        membersByGroupId: {
          ...state.membersByGroupId,
          [groupId]: [...(state.membersByGroupId[groupId] ?? []), ...members],
        },
        membersNextCursorByGroupId: { ...state.membersNextCursorByGroupId, [groupId]: nextCursor },
        membersLoadMoreStatusByGroupId: {
          ...state.membersLoadMoreStatusByGroupId,
          [groupId]: 'success',
        },
      }));
    } catch {
      set((state) => ({
        membersLoadMoreStatusByGroupId: {
          ...state.membersLoadMoreStatusByGroupId,
          [groupId]: 'error',
        },
      }));
    }
  },
  removeMember: async (groupId, userId) => {
    await removeGroupMemberAction(groupId, userId);
    set((state) => ({
      membersByGroupId: {
        ...state.membersByGroupId,
        [groupId]: (state.membersByGroupId[groupId] ?? []).filter(
          (member) => member.user.id !== userId,
        ),
      },
      groupsById: state.groupsById[groupId]
        ? {
            ...state.groupsById,
            [groupId]: {
              ...state.groupsById[groupId],
              membersCount: Math.max(0, state.groupsById[groupId].membersCount - 1),
            },
          }
        : state.groupsById,
    }));
  },
}));
