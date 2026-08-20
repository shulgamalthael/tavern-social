/** Профиль чужого пользователя — в отличие от `CurrentUser`, несёт статус
 * дружбы относительно текущего пользователя (для кнопок на его странице). */
export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  tagline: string;
  city: string | null;
  about: string | null;
  tags: string[];
  isFriend: boolean;
  hasOutgoingRequest: boolean;
  hasIncomingRequest: boolean;
}
