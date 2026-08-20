'use server';

import { getInitials } from '@/shared/lib/get-initials';
import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type {
  Notification,
  NotificationActor,
  NotificationsPage,
  NotificationType,
} from '../model/types';

interface PublicProfileResponse {
  id: string;
  name: string;
}

interface NotificationResponse {
  id: string;
  type: NotificationType;
  actor: PublicProfileResponse;
  actorCount: number;
  recentActors: PublicProfileResponse[];
  post: { id: string; text: string } | null;
  commentText: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsListResponse {
  items: NotificationResponse[];
  nextCursor: string | null;
}

function mapActor(actor: PublicProfileResponse): NotificationActor {
  return { id: actor.id, name: actor.name, initials: getInitials(actor.name) };
}

function mapNotification(notification: NotificationResponse): Notification {
  return {
    id: notification.id,
    type: notification.type,
    actor: mapActor(notification.actor),
    actorCount: notification.actorCount,
    recentActors: notification.recentActors.map(mapActor),
    post: notification.post,
    commentText: notification.commentText,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}

export async function getNotifications(cursor?: string | null): Promise<NotificationsPage> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await backendFetch<NotificationsListResponse>(`/notifications${query}`, {
    token,
  });
  return { items: response.items.map(mapNotification), nextCursor: response.nextCursor };
}
