import { Card } from '@/shared/ui/Card';
import { hasProfileBadges, ProfileBadges, type ProfileBadgesProps } from './ProfileBadges';

/**
 * Отдельная карточка боковой колонки, выше «О себе» (`AboutCard`) — только
 * бейджи роли, без подписок (та — своя соседняя карточка,
 * `ProfileFollowStatsCard`; раньше были объединены в одну, по просьбе
 * разделены обратно). Сама решает, рисовать ли `Card` вообще —
 * `hasProfileBadges` (см. её комментарий в `ProfileBadges.tsx`), иначе на
 * странице пользователя без единой роли остался бы пустой прямоугольник.
 */
export function ProfileBadgesCard(props: ProfileBadgesProps) {
  if (!hasProfileBadges(props)) return null;

  return (
    <Card>
      <ProfileBadges {...props} />
    </Card>
  );
}
