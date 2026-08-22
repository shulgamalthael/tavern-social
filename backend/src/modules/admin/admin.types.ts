import type { GroupType, UserRole } from '@prisma/client';

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  postsCount: number;
}

export interface AdminPostDto {
  id: string;
  /** У карточки-репоста (`repostOfId` задан) это всегда пусто — см.
   * `Post.text` в схеме — поэтому в списке админки показывается текст
   * оригинала с пометкой репоста, см. `AdminService.toPostDto`. */
  text: string;
  isRepost: boolean;
  /** URL картинок в контенте (см. `extractImageUrls`) — для репоста уже
   * из текста оригинала, тем же принципом, что и `text` выше. Нужен
   * админке, чтобы показать превью, когда `text` пуст или содержит только
   * картинку (типичный случай для загрузок в галерею). */
  images: string[];
  hasTable: boolean;
  hasLink: boolean;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface AdminGroupDto {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  postsCount: number;
  createdAt: string;
}

/** У Community нет реального загруженного изображения — `cover` в схеме
 * это текстовая подпись обложки (см. seed.ts), а не `/uploads/...` путь, в
 * отличие от `Group.coverUrl`. Поэтому удаление сообщества не чистит файлы
 * на диске (см. `AdminService.deleteCommunity`). */
export interface AdminCommunityDto {
  id: string;
  name: string;
  about: string;
  cover: string;
  membersCount: number;
  postsCount: number;
  createdAt: string;
}

/** Точка ряда графика — один день, одно число. Тот же формат для любого
 * временного ряда на дашборде (регистрации/посты), не отдельный тип на
 * каждый. */
export interface AdminDailyPoint {
  date: string;
  count: number;
}

export interface AdminTopAuthor {
  userId: string;
  name: string;
  avatarUrl: string | null;
  postsCount: number;
}

/** Тот же принцип, что и `AdminTopAuthor` — самые крупные группы/сообщества
 * по числу участников, для быстрой ориентации на дашборде. */
export interface AdminTopCircle {
  id: string;
  name: string;
  avatarUrl: string | null;
  membersCount: number;
}

export interface AdminStatsDto {
  totals: {
    users: number;
    bannedUsers: number;
    posts: number;
    comments: number;
    groups: number;
    communities: number;
  };
  usersByDay: AdminDailyPoint[];
  postsByDay: AdminDailyPoint[];
  topAuthors: AdminTopAuthor[];
  topGroups: AdminTopCircle[];
  topCommunities: AdminTopCircle[];
}
