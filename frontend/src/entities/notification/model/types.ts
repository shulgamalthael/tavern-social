/** Ровно те типы взаимодействий, которые реально существуют в бизнес-логике
 * приложения — без выдуманных упоминаний/ответов на комментарии и т. п. */
export type NotificationType =
  'friend_request' | 'friend_accepted' | 'post_like' | 'post_comment' | 'post_repost';

export interface NotificationActor {
  id: string;
  name: string;
  initials: string;
}

export interface NotificationPost {
  id: string;
  text: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  actor: NotificationActor;
  /** >1 только для сгруппированных post_like/post_repost — «Аля и ещё 3». */
  actorCount: number;
  recentActors: NotificationActor[];
  post: NotificationPost | null;
  commentText: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: Notification[];
  nextCursor: string | null;
}
