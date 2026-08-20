export type SectionId =
  | 'profile'
  | 'feed'
  | 'messages'
  | 'friends'
  | 'communities'
  | 'groups'
  | 'settings'
  | 'notifications';

export interface NavItem {
  id: SectionId;
  label: string;
  short: string;
}
