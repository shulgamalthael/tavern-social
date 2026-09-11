import { Card } from '@/shared/ui/Card';
import { ProfileFollowStats, type ProfileFollowStatsProps } from './ProfileFollowStats';

/**
 * Отдельная карточка боковой колонки, выше «О себе» (`AboutCard`) — только
 * подписки/подписчики, без бейджей роли (та — своя соседняя карточка,
 * `ProfileBadgesCard`; раньше были объединены в одну, по просьбе разделены
 * обратно). В отличие от `ProfileBadgesCard` рендерится всегда — счётчики
 * подписок есть даже при нуле, пустого состояния тут не бывает.
 */
export function ProfileFollowStatsCard(props: ProfileFollowStatsProps) {
  return (
    <Card>
      <ProfileFollowStats {...props} />
    </Card>
  );
}
