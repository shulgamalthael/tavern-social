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
  /** Переопределяет --tavern-accent для этого пользователя. */
  accent?: string;
  about: string | null;
  city: string | null;
  tags: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
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
}
