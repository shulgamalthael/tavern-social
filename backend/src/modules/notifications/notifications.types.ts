import type { NotificationType } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

export interface NotificationPostSummary {
  id: string;
  text: string;
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
