import type { GroupType } from '@/entities/group';
import type { UserRole } from '@/entities/user';

export type AdminUserRoleFilter = 'all' | UserRole;
export type AdminUserStatusFilter = 'all' | 'active' | 'banned';
export type AdminPostTypeFilter = 'all' | 'original' | 'repost';
export type AdminPostLocationFilter = 'all' | 'wall' | 'group';

export interface AdminUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  isBanned: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  postsCount: number;
}

export interface AdminUsersPage {
  items: AdminUser[];
  nextCursor: string | null;
}

export interface AdminPost {
  id: string;
  /** У репоста — текст оригинала (см. `AdminService.listPosts` на backend) —
   * своего текста у карточки-обёртки нет. */
  text: string;
  isRepost: boolean;
  /** URL картинок в контенте, для репоста — уже из оригинала (тем же
   * принципом, что и `text`). Позволяет показать превью, когда текста нет
   * (загрузка в галерею) или он не описывает суть поста. */
  images: string[];
  hasTable: boolean;
  hasLink: boolean;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorAvatarUrl: string | null;
  groupId: string | null;
  groupName: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface AdminPostsPage {
  items: AdminPost[];
  nextCursor: string | null;
}

export interface AdminGroup {
  id: string;
  name: string;
  initials: string;
  description: string;
  type: GroupType;
  avatarUrl: string | null;
  coverUrl: string | null;
  membersCount: number;
  postsCount: number;
  createdAt: string;
}

export interface AdminGroupsPage {
  items: AdminGroup[];
  nextCursor: string | null;
}

/** У Community нет своей картинки (см. `cover` — текстовая подпись, а не
 * файл, см. `AdminService` на backend), поэтому в списке — только инициалы,
 * как у пользователя без аватара. */
export interface AdminCommunity {
  id: string;
  name: string;
  initials: string;
  about: string;
  cover: string;
  membersCount: number;
  postsCount: number;
  createdAt: string;
}

export interface AdminCommunitiesPage {
  items: AdminCommunity[];
  nextCursor: string | null;
}

export interface AdminDailyPoint {
  date: string;
  count: number;
}

export interface AdminTopAuthor {
  userId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  postsCount: number;
}

export interface AdminTopCircle {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  membersCount: number;
}

export interface AdminStats {
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
