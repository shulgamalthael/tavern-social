'use client';

import { useState } from 'react';
import type { AdminDailyPoint } from '@/entities/admin';
import { cn } from '@/shared/lib/cn';
import styles from './DailyBarChart.module.scss';

const CHART_WIDTH = 600;
const CHART_HEIGHT = 120;
const CHART_BAR_GAP = 2;

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export interface DailyBarChartProps {
  title: string;
  points: AdminDailyPoint[];
}

/**
 * Общий однорядный столбчатый график для любого временного ряда в админке
 * (изначально — `AdminDashboard`'s регистрации/посты за 30 дней, теперь
 * переиспользуется и `AdminAdvertisingPanel` для показов/кликов — вынесено
 * сюда именно поэтому, не копия). Один ряд — свой хью не нужен (см.
 * `dataviz`, «Sequential = один hue»): заголовок уже называет серию,
 * легенда не нужна. Подсказка при наведении — текстом над графиком, а не
 * всплывающим тултипом за пределами SVG: проще и не требует портала/
 * позиционирования для одного числа.
 */
export function DailyBarChart({ title, points }: DailyBarChartProps) {
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
