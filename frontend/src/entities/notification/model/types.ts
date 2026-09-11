/** Ровно те типы взаимодействий, которые реально существуют в бизнес-логике
 * приложения — без выдуманных упоминаний/ответов на комментарии и т. п. */
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'subscription_request'
  | 'subscription_accepted'
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

/** Отдельная, лёгкая форма — не `Notification` с занулёнными полями. Business
 * Logic Engine (AI_PLATFORM_ROADMAP.md §2.5/§13/§15.4) отправляет её
 * владельцу бизнеса при срабатывании правила (`send_notification`-действие);
 * у события нет человека-"актёра" (заказ/запись/форма пришли от анонимного
 * посетителя витрины), поэтому это не `Notification` — тот же принцип, что у
 * backend's `BusinessNotificationDto` (см. её комментарий в
 * `notifications.types.ts`), две независимые копии одного контракта. */
export interface BusinessNotification {
  id: string;
  summary: string;
  isRead: boolean;
  createdAt: string;
}
