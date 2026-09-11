'use client';

import { getAdminStats } from '@/entities/admin';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { DailyBarChart } from './DailyBarChart';
import styles from './AdminDashboard.module.scss';

const STAT_TILES: {
  key: 'users' | 'bannedUsers' | 'posts' | 'comments' | 'groups' | 'communities';
  label: string;
}[] = [
  { key: 'users', label: 'Пользователи' },
  { key: 'bannedUsers', label: 'В бане' },
  { key: 'posts', label: 'Записи' },
  { key: 'comments', label: 'Комментарии' },
  { key: 'groups', label: 'Группы' },
  { key: 'communities', label: 'Сообщества' },
];

export function AdminDashboard() {
  const { status, data, error, refetch } = useAsyncData(getAdminStats);

  if (status === 'loading') {
    return <Loader label="Считаем статистику…" />;
  }
  if (status === 'error') {
    return <ErrorState message={error} onRetry={refetch} />;
  }
  if (!data) return null;

  return (
    <div className={styles['admin-dashboard']}>
      <div className={styles['admin-dashboard__tiles']}>
        {STAT_TILES.map((tile) => (
          <Card key={tile.key} className={styles['admin-dashboard__tile']}>
            <span className={styles['admin-dashboard__tile-value']}>{data.totals[tile.key]}</span>
            <span className={styles['admin-dashboard__tile-label']}>{tile.label}</span>
          </Card>
        ))}
      </div>

      <div className={styles['admin-dashboard__charts']}>
        <Card>
          <DailyBarChart title="Регистрации за 30 дней" points={data.usersByDay} />
        </Card>
        <Card>
          <DailyBarChart title="Новые записи за 30 дней" points={data.postsByDay} />
        </Card>
      </div>

      <Card>
        <h3 className={styles['admin-dashboard__section-title']}>Самые активные авторы</h3>
        {data.topAuthors.length === 0 ? (
          <EmptyState title="Пока нет ни одной записи" />
        ) : (
          <div className={styles['admin-dashboard__authors']}>
            {data.topAuthors.map((author, index) => (
              <div key={author.userId} className={styles['admin-dashboard__author']}>
                <span className={styles['admin-dashboard__author-rank']}>{index + 1}</span>
                <Avatar initials={author.initials} src={author.avatarUrl} size="sm" />
                <span className={styles['admin-dashboard__author-name']}>{author.name}</span>
                <span className={styles['admin-dashboard__author-count']}>
                  {author.postsCount} записей
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className={styles['admin-dashboard__charts']}>
        <Card>
          <h3 className={styles['admin-dashboard__section-title']}>Крупнейшие группы</h3>
          {data.topGroups.length === 0 ? (
            <EmptyState title="Групп пока нет" />
          ) : (
            <div className={styles['admin-dashboard__authors']}>
              {data.topGroups.map((group, index) => (
                <div key={group.id} className={styles['admin-dashboard__author']}>
                  <span className={styles['admin-dashboard__author-rank']}>{index + 1}</span>
                  <Avatar initials={group.initials} src={group.avatarUrl} size="sm" />
                  <span className={styles['admin-dashboard__author-name']}>{group.name}</span>
                  <span className={styles['admin-dashboard__author-count']}>
                    {group.membersCount} участников
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h3 className={styles['admin-dashboard__section-title']}>Крупнейшие сообщества</h3>
          {data.topCommunities.length === 0 ? (
            <EmptyState title="Сообществ пока нет" />
          ) : (
            <div className={styles['admin-dashboard__authors']}>
              {data.topCommunities.map((community, index) => (
                <div key={community.id} className={styles['admin-dashboard__author']}>
                  <span className={styles['admin-dashboard__author-rank']}>{index + 1}</span>
                  <Avatar initials={community.initials} size="sm" />
                  <span className={styles['admin-dashboard__author-name']}>{community.name}</span>
                  <span className={styles['admin-dashboard__author-count']}>
                    {community.membersCount} участников
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
