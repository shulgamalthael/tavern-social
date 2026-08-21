'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '@/entities/notification';
import { useCurrentUser } from '@/entities/user';
import { SearchDropdown } from '@/features/global-search';
import { useNavigationStore } from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { BellIcon, SearchIcon } from '@/shared/ui/icons';
import { NotificationsDropdown } from './NotificationsDropdown';
import styles from './Header.module.scss';

/** Расстояние прокрутки, после которого спокойная (прозрачная) шапка
 * сменяется текущей компактной плашкой — см. `useEffect` со скролл-слушателем. */
const SCROLL_THRESHOLD_PX = 32;

export function Header() {
  const { currentUser } = useCurrentUser();
  const goToSection = useNavigationStore((state) => state.goToSection);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loadFirstPage = useNotificationStore((state) => state.loadFirstPage);

  const [query, setQuery] = useState('');
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isScrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notificationsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Реальный скроллящийся контейнер приложения — не `window`: `.app`
    // (`app/home-app.tsx`) сам является `overflow-y: auto`-элементом,
    // `Header` рендерится его прямым ребёнком (см. `usePersistedScroll`,
    // тот же контейнер). Слушаем родителя напрямую вместо завязки на имя
    // CSS-класса (хэшируется модулями) или проброса ref через пропы.
    const scrollParent = headerRef.current?.parentElement;
    if (!scrollParent) return undefined;

    const onScroll = () => setScrolled(scrollParent.scrollTop > SCROLL_THRESHOLD_PX);
    onScroll();
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', onScroll);
  }, []);

  const closeSearch = () => setSearchOpen(false);
  const closeNotifications = () => setNotificationsOpen(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        closeSearch();
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        closeSearch();
      }
      if (!notificationsContainerRef.current?.contains(event.target as Node)) {
        closeNotifications();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const toggleNotifications = () => {
    // Загрузка — сайд-эффект обработчика клика, а не апдейтера `useState`:
    // вызов Zustand-`set` внутри функции-апдейтера нарушает чистоту апдейтера
    // и ловится React как «Cannot update a component while rendering another».
    if (!isNotificationsOpen) void loadFirstPage();
    setNotificationsOpen((open) => !open);
  };

  return (
    <header ref={headerRef} className={cn(styles.header, isScrolled && styles['header--scrolled'])}>
      <div className={styles['header__inner']}>
        <button
          type="button"
          className={styles['header__logo']}
          onClick={() => goToSection('feed')}
        >
          <span className={styles['header__logo-dot']} aria-hidden="true" />
          <span className={styles['header__logo-text']}>Таверна</span>
        </button>

        <div className={styles['header__search']} ref={searchContainerRef}>
          <label className={styles['header__search-field']}>
            <SearchIcon className={styles['header__search-icon']} />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Найти человека, сообщество, сбор"
            />
            {query ? (
              <button
                type="button"
                className={styles['header__search-clear']}
                aria-label="Очистить поиск"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
              >
                ×
              </button>
            ) : (
              <kbd>⌘K</kbd>
            )}
          </label>
          {isSearchOpen && <SearchDropdown query={query} onNavigate={closeSearch} />}
        </div>

        <div className={styles['header__actions']}>
          <div className={styles['header__notifications']} ref={notificationsContainerRef}>
            <button
              type="button"
              className={styles['header__bell-button']}
              aria-label="Уведомления"
              aria-expanded={isNotificationsOpen}
              onClick={toggleNotifications}
            >
              <BellIcon />
              {unreadCount > 0 && (
                <Badge variant="accent" className={styles['header__bell-badge']}>
                  {unreadCount}
                </Badge>
              )}
            </button>
            {isNotificationsOpen && (
              <NotificationsDropdown
                onClose={closeNotifications}
                onViewAll={() => {
                  closeNotifications();
                  goToSection('notifications');
                }}
              />
            )}
          </div>

          <button
            type="button"
            className={styles['header__avatar-button']}
            onClick={() => goToSection('profile')}
          >
            <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} />
          </button>
        </div>
      </div>
    </header>
  );
}
