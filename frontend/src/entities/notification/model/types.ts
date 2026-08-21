/** Ровно те типы взаимодействий, которые реально существуют в бизнес-логике
 * приложения — без выдуманных упоминаний/ответов на комментарии и т. п. */
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'post_like'
  | 'post_comment'
  | 'post_repost'
  | 'group_join_request'
  | 'group_join_accepted';

export interface NotificationActor {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export interface NotificationPost {
  id: string;
  text: string;
  /** Пост — автосозданная запись загрузки фото в галерею — только чтобы
   * текст уведомления мог сказать «фотографию» вместо «запись», без
   * загрузки самой картинки в уведомление (см. NotificationItem/Toast). */
  hasImage: boolean;
}

export interface NotificationGroup {
  id: string;
  name: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  actor: NotificationActor;
  /** >1 только для сгруппированных post_like/post_repost — «Аля и ещё 3». */
  actorCount: number;
  recentActors: NotificationActor[];
  post: NotificationPost | null;
  /** Заполнено для group_join_request/group_join_accepted. */
  group: NotificationGroup | null;
  commentText: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsPage {
  items: Notification[];
  nextCursor: string | null;
}
