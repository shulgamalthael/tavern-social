import type { NotificationType } from '../model/types';

/**
 * Клик по строке уведомления (не по аватару/имени — тот всегда ведёт на
 * профиль автора действия, см. `NotificationItem.onAuthorClick`) должен вести
 * туда, где имеет смысл именно этот тип: заявка/принятие дружбы — в раздел
 * «Друзья» (там появляется сама заявка/новый друг), лайк/комментарий/репост —
 * на свою стену, где лежит сама запись, заявка/принятие в группу — в раздел
 * «Группы» (конкретную группу открывает вызывающий widget напрямую через
 * `goToGroup`, используя `notification.group.id` — см.
 * `widgets/notifications/ui/NotificationsWidget`, эта функция лишь даёт
 * раздел-фолбэк, если группа почему-то не пришла в payload). Не импортирует
 * `SectionId` из `features/section-navigation` (entities не зависят от
 * features, см. AGENTS.md) — возвращает совпадающий по значению строковый
 * литерал, который вызывающий widget передаёт в `goToSection` как есть.
 */
export function resolveNotificationSection(
  type: NotificationType,
): 'profile' | 'friends' | 'groups' {
  if (type === 'friend_request' || type === 'friend_accepted') return 'friends';
  if (type === 'group_join_request' || type === 'group_join_accepted') return 'groups';
  return 'profile';
}
