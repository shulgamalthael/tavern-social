'use client';

import { useEffect, useRef, useState } from 'react';
import { selectUnreadThreadCount, useThreadStore } from '@/entities/thread';
import {
  NAV_ITEMS,
  PRIMARY_NAV_COUNT,
  SECTION_ICONS,
  useNavigationStore,
} from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { MoreIcon } from '@/shared/ui/icons';
import styles from './NavigationDock.module.scss';

const PRIMARY_ITEMS = NAV_ITEMS.slice(0, PRIMARY_NAV_COUNT);
const SECONDARY_ITEMS = NAV_ITEMS.slice(PRIMARY_NAV_COUNT);

/**
 * Единая навигация приложения — плавающий док внизу экрана, одинаковый на
 * мобилке, планшете и десктопе (никаких `@include mobile`-веток на другой
 * набор компонентов). Первые `PRIMARY_NAV_COUNT` пунктов — прямо в доке,
 * остальные — под пунктом «Ещё» в попапе, тот же паттерн анкорного
 * дропдауна с закрытием по клику снаружи, что и у `Header`.
 */
export function NavigationDock() {
  const section = useNavigationStore((state) => state.section);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const unreadCount = useThreadStore(selectUnreadThreadCount);
  const [isMoreOpen, setMoreOpen] = useState(false);
  const moreContainerRef = useRef<HTMLDivElement>(null);

  const isMoreActive = isMoreOpen || SECONDARY_ITEMS.some((item) => item.id === section);

  useEffect(() => {
    if (!isMoreOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!moreContainerRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMoreOpen]);

  const select = (sectionId: (typeof NAV_ITEMS)[number]['id']) => {
    goToSection(sectionId);
    setMoreOpen(false);
  };

  return (
    <nav className={styles.dock} aria-label="Основные разделы">
      {PRIMARY_ITEMS.map((item) => {
        const Icon = SECTION_ICONS[item.id];
        const isActive = section === item.id;
        const showUnreadBadge = item.id === 'messages' && unreadCount > 0 && !isActive;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            className={cn(styles['dock__item'], isActive && styles['dock__item--active'])}
            onClick={() => select(item.id)}
          >
            <Icon />
            <span className={styles['dock__item-label']}>{item.short}</span>
            {showUnreadBadge && <Badge variant="soft">{unreadCount}</Badge>}
          </button>
        );
      })}

      <div className={styles['dock__more']} ref={moreContainerRef}>
        <button
          type="button"
          aria-label="Ещё разделы"
          aria-expanded={isMoreOpen}
          className={cn(styles['dock__item'], isMoreActive && styles['dock__item--active'])}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreIcon />
          <span className={styles['dock__item-label']}>Ещё</span>
        </button>

        {isMoreOpen && (
          <div className={styles['dock__popover']} role="menu" aria-label="Ещё разделы">
            {SECONDARY_ITEMS.map((item) => {
              const Icon = SECTION_ICONS[item.id];
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    styles['dock__popover-item'],
                    isActive && styles['dock__popover-item--active'],
                  )}
                  onClick={() => select(item.id)}
                >
                  <Icon />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
