import type { PrivacySettings } from '@/entities/user';

export interface SettingsToggle {
  id: keyof PrivacySettings;
  label: string;
  hint: string;
}

/** id совпадает с полями `PrivacySettings` — так проще сопоставлять с ответом backend. */
export const SETTINGS_TOGGLES: SettingsToggle[] = [
  { id: 'quietHours', label: 'Тихий час', hint: 'С 23:00 до 8:00 никаких уведомлений' },
  {
    id: 'showPresence',
    label: 'Показывать, что я в зале',
    hint: 'Друзья видят точку у имени',
  },
  {
    id: 'allowStrangerInvites',
    label: 'Приглашения от незнакомых',
    hint: 'Разрешить звать за стол без общих друзей',
  },
  { id: 'morningDigest', label: 'Утренняя сводка', hint: 'Что случилось в зале, пока вы спали' },
  {
    id: 'isPrivate',
    label: 'Приватная страница',
    hint: 'Стену, фото, друзей и подписки видят только друзья и одобренные подписчики',
  },
];
