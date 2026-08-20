import type { ReactElement } from 'react';
import {
  BellIcon,
  CommunitiesIcon,
  FeedIcon,
  FriendsIcon,
  GroupsIcon,
  type IconProps,
  MessagesIcon,
  ProfileIcon,
  SettingsIcon,
} from '@/shared/ui/icons';
import type { SectionId } from '../model/types';

export const SECTION_ICONS: Record<SectionId, (props: IconProps) => ReactElement> = {
  profile: ProfileIcon,
  feed: FeedIcon,
  messages: MessagesIcon,
  friends: FriendsIcon,
  communities: CommunitiesIcon,
  groups: GroupsIcon,
  settings: SettingsIcon,
  notifications: BellIcon,
};
