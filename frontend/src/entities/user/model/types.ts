export type UserRole = 'user' | 'admin';

export interface CurrentUser {
  id: string;
  name: string;
  initials: string;
  /** Короткая подпись у имени — как в Settings. Пусто, пока пользователь её не заполнил. */
  tagline: string;
  /** Показывать ли пункт «Админка» в навигации (`features/section-navigation`)
   * — реальная защита `/admin/*`-запросов на backend (`AdminGuard`), это
   * поле только про UI. */
  role: UserRole;
  /** Показывать ли в админке кнопку выдачи супер-прав другому пользователю
   * (`widgets/admin/ui/AdminUsersPanel.tsx`) — реальная защита на
   * `SuperAdminGuard`, это поле тоже только про UI, тот же принцип, что и
   * у `role` выше. */
  isSuperAdmin: boolean;
  /** Переопределяет --tavern-accent для этого пользователя. */
  accent?: string;
  about: string | null;
  city: string | null;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  /** Реальная аудитория (`entities/follow`), не друзья — считается на
   * каждый запрос `/users/me`, не кэшируется на клиенте между обновлениями
   * профиля. */
  followersCount: number;
  followingCount: number;
  /** Общее число друзей — не то же самое, что длина списка друзей на
   * странице профиля (тот обрезан, см. `ProfileFriendsCard`). */
  friendsCount: number;
  /** Тот же тумблер, что `PrivacySettings.isPrivate` (§103) — отдельное
   * поле здесь, а не поход в `getMySettings()` при каждом рендере шапки/
   * бейджей: обновляется через `applySettingsUpdate`
   * (`current-user-context.tsx`) сразу после переключения на «Настройках»,
   * без похода на сервер за свежим `CurrentUser` и без сокетов — это
   * локальное состояние текущей вкладки, никому другому мгновенно видеть
   * его не нужно (см. AGENTS.md, раздел про real-time: обычный CRUD, видимый
   * только себе). */
  isPrivate: boolean;
}

/** Поля профиля, которые пользователь может редактировать на странице
 * профиля/в Settings — см. `features/edit-profile`. Partial: патч может
 * затрагивать только часть полей (например, только что загруженный аватар). */
export type EditableProfile = Partial<
  Pick<
    CurrentUser,
    'name' | 'initials' | 'tagline' | 'about' | 'city' | 'tags' | 'avatarUrl' | 'coverUrl'
  >
>;

/** Тумблеры приватности — см. widgets/settings, SETTINGS_TOGGLES. */
export interface PrivacySettings {
  quietHours: boolean;
  showPresence: boolean;
  allowStrangerInvites: boolean;
  morningDigest: boolean;
  isPrivate: boolean;
}
