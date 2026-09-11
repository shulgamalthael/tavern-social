'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { SubscriptionRequestPreview } from '../model/types';

interface SubscriptionRequestUserResponse {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string | null;
  city: string | null;
}

interface SubscriptionRequestResponse {
  user: SubscriptionRequestUserResponse;
  createdAt: string;
}

interface SubscriptionRequestsListResponse {
  incoming: SubscriptionRequestResponse[];
  outgoing: SubscriptionRequestResponse[];
}

function mapRequest(request: SubscriptionRequestResponse): SubscriptionRequestPreview {
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

export async function getSubscriptionRequests(): Promise<{
  incoming: SubscriptionRequestPreview[];
  outgoing: SubscriptionRequestPreview[];
}> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const result = await backendFetch<SubscriptionRequestsListResponse>('/subscriptions/requests', {
    token,
  });
  return {
    incoming: result.incoming.map(mapRequest),
    outgoing: result.outgoing.map(mapRequest),
  };
}
