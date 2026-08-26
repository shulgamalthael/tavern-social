'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/entities/user';
import { ShieldIcon } from '@/shared/ui/icons';
import styles from './AdminBar.module.scss';

const QUICK_LINKS: { hash: string; label: string }[] = [
  { hash: 'dashboard', label: 'Дашборд' },
  { hash: 'users', label: 'Пользователи' },
  { hash: 'posts', label: 'Посты' },
];

/**
 * Полоска-индикатор «вы администратор» поверх основного сайта (не только
 * `/admin`) — тот же приём, что и у WordPress `#wpadminbar`: постоянное
 * напоминание о правах + быстрые ссылки в саму админку, без необходимости
 * искать её в доке («Ещё» → «Админка», см. `NavigationDock`). Рендерится
 * только для `role === 'admin'` — решение принимает вызывающий
 * (`app/home-app.tsx`), сам компонент об этом не знает и роль не проверяет.
 *
 * Намеренно контрастная (`--tavern-ink` фон вместо `--tavern-surface`) и
 * во всю ширину без центрирующего `max-width`, в отличие от `Header` — чтобы
 * не сливаться с ним визуально, как отдельный системный слой поверх темы
 * сайта, а не ещё один ряд той же шапки. Ссылки — на `/admin#tab`, хэш
 * читает `AdminWidget` при монтировании и сразу открывает нужную вкладку.
 *
 * Супер-админ получает свою пилюлю рядом с брендом — у него больше прав
 * (например, только он может выдавать супер-права другим, см.
 * `AdminUsersPanel`/`SuperAdminGuard` на backend), и это должно быть видно
 * с любой страницы сайта, а не только внутри самой `/admin`
 * (`AdminSidebar` показывает тот же бейдж в подписи пользователя).
 */
export function AdminBar() {
  const { currentUser } = useCurrentUser();

  return (
    <div className={styles['admin-bar']}>
      <div className={styles['admin-bar__inner']}>
        <Link href="/admin" className={styles['admin-bar__brand']}>
          <ShieldIcon className={styles['admin-bar__brand-icon']} />
          <span className={styles['admin-bar__brand-label']}>Режим администратора</span>
          {currentUser.isSuperAdmin && (
            <span className={styles['admin-bar__super-badge']}>супер-админ</span>
          )}
        </Link>

        <nav className={styles['admin-bar__links']} aria-label="Быстрые ссылки админки">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.hash}
              href={`/admin#${link.hash}`}
              className={styles['admin-bar__link']}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/admin" className={styles['admin-bar__cta']}>
            Открыть админку →
          </Link>
        </nav>
      </div>
    </div>
  );
}
