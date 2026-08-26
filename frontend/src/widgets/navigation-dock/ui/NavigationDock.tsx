'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { selectUnreadThreadCount, useThreadStore } from '@/entities/thread';
import { useCurrentUser } from '@/entities/user';
import {
  NAV_ITEMS,
  PRIMARY_NAV_COUNT,
  SECTION_ICONS,
  useNavigationStore,
} from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { BriefcaseIcon, MoreIcon, ShieldIcon } from '@/shared/ui/icons';
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
  const { currentUser } = useCurrentUser();
  const [isMoreOpen, setMoreOpen] = useState(false);
  const moreContainerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);

  const isMoreActive = isMoreOpen || SECONDARY_ITEMS.some((item) => item.id === section);

  // Реальная высота дока — в CSS-переменную на `:root`, а не в захардкоженное
  // число: страница (`page.module.scss`, `.app`) резервирует снизу ровно
  // столько места, сколько док занимает по факту, и не «доедает» лишнее, и
  // не проседает, если высота дока когда-нибудь снова изменится (крупнее
  // иконки, новый пункт и т. п.) — без отдельной поправки на каждый такой
  // случай, как раньше. `ResizeObserver` ловит изменение размера дока по
  // любой причине — переключение брейкпоинта тоже меняет реальный
  // `offsetHeight`, не только явный resize окна.
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return undefined;
    const setHeight = () => {
      document.documentElement.style.setProperty('--tavern-dock-h', `${dock.offsetHeight}px`);
    };
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

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
    <nav className={styles.dock} aria-label="Основные разделы" ref={dockRef}>
      {PRIMARY_ITEMS.map((item) => {
        const Icon = SECTION_ICONS[item.id];
        const isActive = section === item.id;
        const showUnreadBadge = item.id === 'messages' && unreadCount > 0 && !isActive;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.short}
            title={item.short}
            className={cn(styles['dock__item'], isActive && styles['dock__item--active'])}
            onClick={() => select(item.id)}
          >
            <Icon />
            <span className={styles['dock__item-label']}>{item.short}</span>
            {showUnreadBadge && (
              <Badge variant="soft" className={styles['dock__badge']}>
                {unreadCount}
              </Badge>
            )}
          </button>
        );
      })}

      <div className={styles['dock__more']} ref={moreContainerRef}>
        <button
          type="button"
          aria-label="Ещё разделы"
          title="Ещё"
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
            {/* Тот же приём, что и у «Админки» ниже — конструктор сайтов не
             * раздел SPA, а отдельная группа маршрутов (`/businesses`,
             * `/business/[id]`, `/business/[id]/edit`, см. `widgets/
             * website-builder`), поэтому обычная ссылка, а не `goToSection`. */}
            <Link href="/businesses" role="menuitem" className={styles['dock__popover-item']}>
              <BriefcaseIcon />
              Бизнесы
            </Link>
            {/* Не `goToSection` — «Админка» больше не клиентский раздел SPA,
             * а отдельный маршрут `/admin` со своей серверной проверкой
             * сессии/роли (см. `app/(protected)/admin/page.tsx`). Обычная
             * ссылка, полноценная навигация, а не смена секции в сторе. */}
            {currentUser.role === 'admin' && (
              <Link href="/admin" role="menuitem" className={styles['dock__popover-item']}>
                <ShieldIcon />
                Админка
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
