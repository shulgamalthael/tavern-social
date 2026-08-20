'use client';

import { selectUnreadThreadCount, useThreadStore } from '@/entities/thread';
import { useCurrentUser } from '@/entities/user';
import {
  MOBILE_PRIMARY_COUNT,
  NAV_ITEMS,
  SECTION_ICONS,
  useNavigationStore,
} from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { MoreIcon } from '@/shared/ui/icons';
import styles from './MobileNavigation.module.scss';

/**
 * Нижняя панель на мобилках — иконки без подписей (как таб-бар Instagram),
 * активный раздел отличается только весом/цветом иконки, без заливки-«пилюли».
 * Плюс лист «Ещё» со вторичными разделами — тот же паттерн, что и раньше,
 * просто визуально переоформлен таб-бар.
 */
export function MobileNavigation() {
  const section = useNavigationStore((state) => state.section);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const isMoreSheetOpen = useNavigationStore((state) => state.isMoreSheetOpen);
  const toggleMoreSheet = useNavigationStore((state) => state.toggleMoreSheet);
  const closeMoreSheet = useNavigationStore((state) => state.closeMoreSheet);
  const unreadCount = useThreadStore(selectUnreadThreadCount);
  const { currentUser } = useCurrentUser();

  const primaryItems = NAV_ITEMS.slice(0, MOBILE_PRIMARY_COUNT);
  const secondaryItems = NAV_ITEMS.slice(MOBILE_PRIMARY_COUNT);
  const isMoreActive = isMoreSheetOpen || secondaryItems.some((item) => item.id === section);

  return (
    <>
      <nav className={styles['tab-bar']} aria-label="Основные разделы">
        {primaryItems.map((item) => {
          const Icon = SECTION_ICONS[item.id];
          const isActive = section === item.id;
          const showUnreadBadge = item.id === 'messages' && unreadCount > 0 && !isActive;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(styles['tab-bar__item'], isActive && styles['tab-bar__item--active'])}
              onClick={() => goToSection(item.id)}
            >
              {item.id === 'profile' ? (
                <Avatar
                  initials={currentUser.initials}
                  size="sm"
                  className={cn(isActive && styles['tab-bar__avatar--active'])}
                />
              ) : (
                <Icon strokeWidth={isActive ? 2.3 : 1.7} />
              )}
              {showUnreadBadge && (
                <Badge variant="accent" className={styles['tab-bar__badge']}>
                  {unreadCount}
                </Badge>
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Ещё разделы"
          aria-expanded={isMoreSheetOpen}
          className={cn(styles['tab-bar__item'], isMoreActive && styles['tab-bar__item--active'])}
          onClick={toggleMoreSheet}
        >
          <MoreIcon strokeWidth={isMoreActive ? 3.2 : 2.6} />
        </button>
      </nav>

      {isMoreSheetOpen && (
        <>
          <div className={styles['sheet-backdrop']} onClick={closeMoreSheet} />
          <div className={styles.sheet} role="dialog" aria-label="Ещё разделы">
            <span className={styles['sheet__handle']} aria-hidden="true" />
            {secondaryItems.map((item) => {
              const Icon = SECTION_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles['sheet__item']}
                  onClick={() => goToSection(item.id)}
                >
                  <Icon />
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
