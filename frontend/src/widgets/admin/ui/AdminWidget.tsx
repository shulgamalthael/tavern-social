'use client';

import { useEffect, useState } from 'react';
import {
  ChartIcon,
  CommunitiesIcon,
  CpuIcon,
  FeedIcon,
  FriendsIcon,
  GroupsIcon,
} from '@/shared/ui/icons';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { AdminAiInfrastructurePanel } from './AdminAiInfrastructurePanel';
import { AdminCommunitiesPanel } from './AdminCommunitiesPanel';
import { AdminDashboard } from './AdminDashboard';
import { AdminGroupsPanel } from './AdminGroupsPanel';
import { AdminPostsPanel } from './AdminPostsPanel';
import { AdminSidebar, type AdminSidebarTabConfig } from './AdminSidebar';
import { AdminUsersPanel } from './AdminUsersPanel';
import styles from './AdminWidget.module.scss';

export type AdminTab =
  'dashboard' | 'users' | 'posts' | 'groups' | 'communities' | 'ai-infrastructure';

const TABS: AdminSidebarTabConfig[] = [
  { id: 'dashboard', label: 'Дашборд', icon: ChartIcon },
  { id: 'users', label: 'Пользователи', icon: FriendsIcon },
  { id: 'posts', label: 'Посты', icon: FeedIcon },
  { id: 'groups', label: 'Группы', icon: GroupsIcon },
  { id: 'communities', label: 'Сообщества', icon: CommunitiesIcon },
  { id: 'ai-infrastructure', label: 'AI-инфраструктура', icon: CpuIcon },
];

const TAB_DESCRIPTION: Record<AdminTab, string> = {
  dashboard: 'Статистика зала за последние 30 дней',
  users: 'Поиск, роли, баны и удаление аккаунтов',
  posts: 'Поиск, фильтры и модерация записей',
  groups: 'Поиск и удаление групп',
  communities: 'Поиск и удаление сообществ',
  'ai-infrastructure': 'Capacity, cost и quota AI Builder’а (Gemini)',
};

function isAdminTab(value: string): value is AdminTab {
  return TABS.some((tab) => tab.id === value);
}

/**
 * Отдельный маршрут `/admin` (`app/(protected)/admin/page.tsx`), не раздел
 * SPA — у него нет общего `Header`/`NavigationDock` из `HomeApp`, поэтому
 * своя навигация — `AdminSidebar` слева (см. её комментарий про `fixed` +
 * `admin-tokens.scss`). Реальная защита — на самой странице
 * (`role !== 'admin'` → redirect) и на backend (`AdminGuard`); этот
 * компонент рендерится, только когда обе проверки уже пройдены.
 *
 * Вкладка читается из `location.hash` при монтировании (не
 * `useSearchParams` — тот требует `<Suspense>` вокруг страницы, чтобы не
 * де-оптимизировать весь маршрут в client-side рендер, а хэш даёт то же
 * самое глубокое связывание без этой возни) — так ссылки вида `/admin#users`
 * из `AdminBar` на основном сайте (см. `widgets/admin/ui/AdminBar.tsx`)
 * открывают нужную вкладку сразу, а не всегда дашборд. Начальный рендер
 * везде отдаёт `'dashboard'` (на сервере `location` не существует), хэш
 * применяется эффектом уже на клиенте — без этого рассинхрон серверного и
 * клиентского первого рендера вызвал бы предупреждение о гидратации.
 */
export function AdminWidget() {
  const [tab, setTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    // Синхронизация с внешней системой (URL), не производное от пропа/состояния —
    // читать location.hash негде, кроме эффекта на клиенте (см. комментарий выше
    // компонента про гидратацию), поэтому `setState` здесь легитимен, а не антипаттерн.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdminTab(hash)) setTab(hash);
  }, []);

  const activeLabel = TABS.find((item) => item.id === tab)?.label ?? '';

  return (
    <div className={styles['admin-shell']}>
      <AdminSidebar tabs={TABS} activeTab={tab} onTabChange={setTab} />

      <div className={styles['admin-shell__content']}>
        <SectionContainer>
          <PageHead title={activeLabel} description={TAB_DESCRIPTION[tab]} />

          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'users' && <AdminUsersPanel />}
          {tab === 'posts' && <AdminPostsPanel />}
          {tab === 'groups' && <AdminGroupsPanel />}
          {tab === 'communities' && <AdminCommunitiesPanel />}
          {tab === 'ai-infrastructure' && <AdminAiInfrastructurePanel />}
        </SectionContainer>
      </div>
    </div>
  );
}
