export interface Friend {
  id: string;
  initials: string;
  avatarUrl: string | null;
  name: string;
  note: string;
  city: string;
  here: boolean;
  status: string;
  since: string;
  mutual: string;
  tags: string[];
  about: string;
}

/** Строка заявки в друзья — тот же превью-набор полей, что и у карточки
 * поиска (см. `features/global-search`), плюс когда заявка отправлена. */
export interface FriendRequestPreview {
  id: string;
  initials: string;
  avatarUrl: string | null;
  name: string;
  tagline: string;
  city: string | null;
  sentAt: string;
}
