import type { Notification } from '../model/types';
import { resolveNotificationSection } from './resolve-notification-section';

interface OpenNotificationTargetActions {
  goToSection: (section: 'profile' | 'friends' | 'groups') => void;
  goToGroup: (groupId: string) => void;
}

/**
 * Куда вести по клику на уведомление — общая функция, а не повторённый в
 * каждом виджете `if`: правило одно и то же в трёх местах (полная страница
 * уведомлений, дропдаун в шапке, toast использует свой отдельный вариант
 * данных и не подходит сюда), дублировать его было бы реальным дублированием
 * бизнес-правила, а не совпадением похожих строк (см. AGENTS.md §1 про DRY).
 * Заявка/принятие в группу — сразу на страницу этой группы; остальные типы —
 * через `resolveNotificationSection`.
 */
export function openNotificationTarget(
  notification: Notification,
  { goToSection, goToGroup }: OpenNotificationTargetActions,
): void {
  if (
    (notification.type === 'group_join_request' || notification.type === 'group_join_accepted') &&
    notification.group
  ) {
    goToGroup(notification.group.id);
    return;
  }
  goToSection(resolveNotificationSection(notification.type));
}
