import type { NavItem } from '../model/types';

/** Первые пункты показываются прямо в доке (иконка + `short`-подпись),
 * остальные — в попапе «Ещё» (иконка + полный `label`). Одно и то же деление
 * на всех брейкпоинтах — единый вид меню, см. `widgets/navigation-dock`.
 * Значение подобрано так, чтобы пункты с `short`-подписями помещались в один
 * ряд без переноса даже на узких мобильных экранах (~360px). */
export const PRIMARY_NAV_COUNT = 4;

export const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Моя страница', short: 'Страница' },
  { id: 'feed', label: 'Новости', short: 'Новости' },
  { id: 'messages', label: 'Сообщения', short: 'Диалоги' },
  { id: 'friends', label: 'Друзья', short: 'Друзья' },
  { id: 'communities', label: 'Сообщества', short: 'Залы' },
  { id: 'groups', label: 'Группы', short: 'Группы' },
  { id: 'settings', label: 'Настройки', short: 'Настройки' },
  { id: 'notifications', label: 'Уведомления', short: 'Уведомл.' },
];
