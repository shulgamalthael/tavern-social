'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { BackIcon, ShieldIcon, type IconProps } from '@/shared/ui/icons';
import type { AdminTab } from './AdminWidget';
import styles from './AdminSidebar.module.scss';

export interface AdminSidebarTabConfig {
  id: AdminTab;
  label: string;
  icon: ComponentType<IconProps>;
}

interface AdminSidebarProps {
  tabs: AdminSidebarTabConfig[];
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

/**
 * Левый сайдбар `/admin` (заменяет прежнюю горизонтальную `AdminHeader` —
 * тот же список вкладок, просто вертикально, как в WordPress). `position:
 * fixed`, не `sticky`: у `/admin` нет `.app`-скролл-контейнера, страница
 * скроллится обычным document/window — сайдбар должен оставаться на месте
 * при любой длине контента, `fixed` даёт это без обвязки на скролл-события.
 * `AdminWidget` балансирует это отступом `margin-left` на контентной колонке
 * (см. `AdminWidget.module.scss`, оба берут ширину из `admin-tokens.scss`).
 * На узких экранах (`@include mobile`) подписи прячутся и сайдбар
 * схлопывается в иконочную рельсу — тот же приём, что раньше был у
 * горизонтальных вкладок, просто в вертикальной раскладке.
 */
export function AdminSidebar({ tabs, activeTab, onTabChange }: AdminSidebarProps) {
  const { currentUser } = useCurrentUser();

  return (
    <aside className={styles['admin-sidebar']}>
      <Link href="/" className={styles['admin-sidebar__back']} aria-label="Назад в Таверну">
        <BackIcon />
        <span className={styles['admin-sidebar__back-label']}>Назад в Таверну</span>
      </Link>

      <span className={styles['admin-sidebar__brand']}>
        <ShieldIcon className={styles['admin-sidebar__brand-icon']} />
        <span className={styles['admin-sidebar__brand-label']}>Админка</span>
      </span>

      <nav className={styles['admin-sidebar__nav']} role="tablist" aria-label="Разделы админки">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            title={tab.label}
            aria-label={tab.label}
            aria-selected={activeTab === tab.id}
            className={cn(
              styles['admin-sidebar__nav-item'],
              activeTab === tab.id && styles['admin-sidebar__nav-item--active'],
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <tab.icon />
            <span className={styles['admin-sidebar__nav-label']}>{tab.label}</span>
          </button>
        ))}
      </nav>

      <span className={styles['admin-sidebar__user']} title={`Вы вошли как ${currentUser.name}`}>
        <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} size="sm" />
        <span className={styles['admin-sidebar__user-name']}>{currentUser.name}</span>
      </span>
    </aside>
  );
}
