'use client';

import { useState } from 'react';
import { getAdminStats, type AdminDailyPoint } from '@/entities/admin';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './AdminDashboard.module.scss';

const CHART_WIDTH = 600;
const CHART_HEIGHT = 120;
const CHART_BAR_GAP = 2;

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

interface DailyBarChartProps {
  title: string;
  points: AdminDailyPoint[];
}

/**
 * Один ряд — свой хью не нужен (см. `dataviz`, «Sequential = один hue»):
 * заголовок уже называет серию, легенда не нужна. Подсказка при наведении —
 * текстом над графиком, а не всплывающим тултипом за пределами SVG: проще
 * и не требует портала/позиционирования для одного числа.
 */
function DailyBarChart({ title, points }: DailyBarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((point) => point.count));
  const barWidth = (CHART_WIDTH - CHART_BAR_GAP * (points.length - 1)) / points.length;
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className={styles['admin-chart']}>
      <div className={styles['admin-chart__header']}>
        <h3 className={styles['admin-chart__title']}>{title}</h3>
        <span className={styles['admin-chart__value']}>
          {hovered
            ? `${formatShortDate(hovered.date)} · ${hovered.count}`
            : `Всего за период: ${total}`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className={styles['admin-chart__svg']}
        role="img"
        aria-label={`${title}: всего ${total} за последние ${points.length} дней`}
        preserveAspectRatio="none"
      >
        {points.map((point, index) => {
          const barHeight = Math.max(2, (point.count / max) * (CHART_HEIGHT - 4));
          const x = index * (barWidth + CHART_BAR_GAP);
          const y = CHART_HEIGHT - barHeight;
          return (
            <rect
              key={point.date}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={Math.min(2, barWidth / 2)}
              className={cn(
                styles['admin-chart__bar'],
                hoverIndex === index && styles['admin-chart__bar--hover'],
              )}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          );
        })}
      </svg>
    </div>
  );
}

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
