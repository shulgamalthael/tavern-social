'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { AdminDailyPoint, AdminStats } from '../model/types';

interface AdminTopCircleResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
  membersCount: number;
}

interface AdminStatsResponse {
  totals: AdminStats['totals'];
  usersByDay: AdminDailyPoint[];
  postsByDay: AdminDailyPoint[];
  topAuthors: { userId: string; name: string; avatarUrl: string | null; postsCount: number }[];
  topGroups: AdminTopCircleResponse[];
  topCommunities: AdminTopCircleResponse[];
}

export async function getAdminStats(): Promise<AdminStats> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const response = await backendFetch<AdminStatsResponse>('/admin/stats', { token });
  return {
    ...response,
    topAuthors: response.topAuthors.map((author) => ({
      ...author,
      initials: getInitials(author.name),
    })),
    topGroups: response.topGroups.map((group) => ({ ...group, initials: getInitials(group.name) })),
    topCommunities: response.topCommunities.map((community) => ({
      ...community,
      initials: getInitials(community.name),
    })),
  };
}
