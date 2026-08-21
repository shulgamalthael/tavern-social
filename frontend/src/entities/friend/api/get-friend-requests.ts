'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { FriendRequestPreview } from '../model/types';

interface FriendRequestUserResponse {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string | null;
  city: string | null;
}

interface FriendRequestResponse {
  user: FriendRequestUserResponse;
  createdAt: string;
}

interface FriendRequestsListResponse {
  incoming: FriendRequestResponse[];
  outgoing: FriendRequestResponse[];
}

function mapRequest(request: FriendRequestResponse): FriendRequestPreview {
  return {
    id: request.user.id,
    initials: getInitials(request.user.name),
    avatarUrl: request.user.avatarUrl,
    name: request.user.name,
    tagline: request.user.tagline,
    city: request.user.city,
    sentAt: formatRelativeTime(request.createdAt),
  };
}

export async function getFriendRequests(): Promise<{
  incoming: FriendRequestPreview[];
  outgoing: FriendRequestPreview[];
}> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const result = await backendFetch<FriendRequestsListResponse>('/friends/requests', { token });
  return {
    incoming: result.incoming.map(mapRequest),
    outgoing: result.outgoing.map(mapRequest),
  };
}
