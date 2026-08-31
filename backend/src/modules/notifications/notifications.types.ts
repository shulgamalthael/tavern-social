import type { NotificationType } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

export interface NotificationPostSummary {
  id: string;
  text: string;
  /** Есть ли в тексте поста хотя бы одна картинка (см.
   * common/lib/post-image-placeholders.ts#extractImageUrls) — только чтобы
   * текст уведомления мог сказать «фотографию» вместо «запись», без загрузки
   * самой картинки в уведомление. */
  hasImage: boolean;
}

export interface NotificationGroupSummary {
  id: string;
  name: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  actor: PublicProfile;
  /** Сколько раз это взаимодействие произошло, пока уведомление непрочитано
   * (группировка — только post_like/post_repost, иначе всегда 1). */
  actorCount: number;
  /** До 3 последних участников группировки, самый свежий первым. */
  recentActors: PublicProfile[];
  post: NotificationPostSummary | null;
  /** Заполнено для `group_join_request`/`group_join_accepted`. */
  group: NotificationGroupSummary | null;
  /** Текст комментария — только для post_comment, всегда живой join к
   * Comment, никогда не дублируется в самой записи (см. schema.prisma). */
  commentText: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsListDto {
  items: NotificationDto[];
  nextCursor: string | null;
}

/** Отдельная, ЛЁГКАЯ форма — не `NotificationDto` с занулённым `actor`, тот
 * же принцип, что `AuditLogListItem` (AI-3, §10.7): бизнес-notifications
 * экран (`NotificationsService.listForBusiness`, §15.4) не показывает
 * `actor`/`post`/`group`/`commentText` — их и нет у `rule_triggered`,
 * единственного типа, который этот эндпоинт вообще отдаёт. */
export interface BusinessNotificationDto {
  id: string;
  summary: string;
  isRead: boolean;
  createdAt: string;
}
