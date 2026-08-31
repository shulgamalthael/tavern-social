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
  /** Защищённый уровень поверх role='admin' — нельзя забанить/удалить/
   * понизить в роли никому, кроме другого супер-админа (см.
   * `widgets/admin/ui/AdminUsersPanel.tsx`, `setSuperAdmin`). */
  isSuperAdmin: boolean;
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
  /** URL картинок в контенте, в порядке появления, для репоста — уже из
   * оригинала (тем же принципом, что и `text`). `text` рендерится в
   * `AdminPostsPanel` как есть — этот список нужен только для
   * `ImageLightbox` при клике по инлайн-картинке, тем же приёмом, что и
   * `Post.images`/`PostCard` на основном сайте. */
  images: string[];
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

/** AI Capacity & Cost Manager — зеркалит `AiInfrastructureOverviewDto`
 * (`backend/src/modules/ai/capacity/ai-capacity.types.ts`) один в один, без
 * промежуточного маппинга: backend уже отдаёт данные в форме, готовой для
 * рендера (проценты уже посчитаны, суммы уже в микро-USD), лишний слой
 * трансформации здесь был бы просто дублированием. */
export type AiCapacityStatus = 'normal' | 'warning' | 'critical' | 'emergency';

export interface AiCapacitySnapshot {
  rpm: { used: number; safetyLimit: number; officialLimit: number; usedPercent: number };
  rpd: { used: number; safetyLimit: number; officialLimit: number; usedPercent: number };
  tpm: { used: number };
  status: AiCapacityStatus;
}

export interface AiCostSummary {
  todayCostMicros: number;
  monthCostMicros: number;
  todayRequestCount: number;
  monthRequestCount: number;
}

export interface AiForecast {
  sufficientData: boolean;
  averageDailyGrowthPercent: number;
  projectedRequestsIn30Days: number;
  daysUntilCapacityInsufficient: number | null;
}

export interface AiBudgetStatus {
  scope: 'global' | 'business';
  businessId: string | null;
  monthlyLimitCents: number;
  spentMicros: number;
  remainingMicros: number;
  spentPercent: number;
}

export interface AiUsageByOperation {
  operation: string;
  requestCount: number;
  totalTokens: number;
  costMicros: number;
}

export interface AiUsageByBusiness {
  businessId: string;
  requestCount: number;
  totalTokens: number;
  costMicros: number;
}

export interface AiAlert {
  id: string;
  type: string;
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
  createdAt: string;
}

export interface AiAnomaly {
  id: string;
  type: string;
  description: string;
  detectedAt: string;
}

export interface AiRecommendation {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface AiInfrastructureOverview {
  capacity: AiCapacitySnapshot;
  cost: AiCostSummary;
  forecast: AiForecast;
  budgets: AiBudgetStatus[];
  topOperations: AiUsageByOperation[];
  topBusinesses: AiUsageByBusiness[];
  recentAlerts: AiAlert[];
  recentAnomalies: AiAnomaly[];
  recommendations: AiRecommendation[];
  tierInfo: {
    providerTierDetectionAvailable: false;
    currentLimits: { rpm: number; rpd: number };
  };
}
