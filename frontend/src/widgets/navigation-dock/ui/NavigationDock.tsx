'use client';

import { selectUnreadThreadCount, useThreadStore } from '@/entities/thread';
import { NAV_ITEMS, SECTION_ICONS, useNavigationStore } from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import styles from './NavigationDock.module.scss';

/** Десктопная навигация — плавающий док внизу экрана, скрыт на мобильных брейкпоинтах. */
export function NavigationDock() {
  const section = useNavigationStore((state) => state.section);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const unreadCount = useThreadStore(selectUnreadThreadCount);

  return (
    <nav className={styles.dock} aria-label="Основные разделы">
      {NAV_ITEMS.map((item) => {
        const Icon = SECTION_ICONS[item.id];
        const isActive = section === item.id;
        const showUnreadBadge = item.id === 'messages' && unreadCount > 0 && !isActive;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            className={cn(styles['dock__item'], isActive && styles['dock__item--active'])}
            onClick={() => goToSection(item.id)}
          >
            <Icon />
            {item.label}
            {showUnreadBadge && <Badge variant="soft">{unreadCount}</Badge>}
          </button>
        );
      })}
    </nav>
  );
}
