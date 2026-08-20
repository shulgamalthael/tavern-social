import type { NavItem } from '../model/types';

/** Первые пять пунктов — в мобильной панели, остальные — в листе «Ещё». */
export const MOBILE_PRIMARY_COUNT = 5;

export const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Моя страница', short: 'Страница' },
  { id: 'feed', label: 'Новости', short: 'Новости' },
  { id: 'messages', label: 'Сообщения', short: 'Диалоги' },
  { id: 'friends', label: 'Друзья', short: 'Друзья' },
  { id: 'communities', label: 'Сообщества', short: 'Залы' },
  { id: 'groups', label: 'Группы', short: 'Группы' },
  { id: 'settings', label: 'Настройки', short: 'Ещё' },
  { id: 'notifications', label: 'Уведомления', short: 'Уведомления' },
];
