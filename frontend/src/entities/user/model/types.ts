export interface CurrentUser {
  id: string;
  name: string;
  initials: string;
  /** Короткая подпись у имени — как в Settings. Пусто, пока пользователь её не заполнил. */
  tagline: string;
  /** Переопределяет --tavern-accent для этого пользователя. */
  accent?: string;
}

/** Поля профиля, которые пользователь может редактировать в Settings. */
export type EditableProfile = Pick<CurrentUser, 'name' | 'initials' | 'tagline'>;

/** Тумблеры приватности — см. widgets/settings, SETTINGS_TOGGLES. */
export interface PrivacySettings {
  quietHours: boolean;
  showPresence: boolean;
  allowStrangerInvites: boolean;
  morningDigest: boolean;
}
