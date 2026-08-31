import {
  GROWTH_ADVERTISING_COMPARISON,
  PLAN_CATALOG,
  type ComparisonLevel,
} from '@/entities/subscription';
import { cn } from '@/shared/lib/cn';
import styles from './GrowthComparisonTable.module.scss';

const LEVEL_LABELS: Record<ComparisonLevel, string> = {
  none: '—',
  basic: 'Базовый',
  advanced: 'Продвинутый',
  custom: 'Индивидуально',
};

/** Отдельная категория сравнения тарифов "Growth & Advertising" (§14
 * исходного brief'а) — показывает не наличие/отсутствие фичи галочкой, а
 * УРОВЕНЬ возможности текстом (см. `ComparisonLevel`'s комментарий), той же
 * идеей, что и у `GrowthStrategyPanel`: пользователю важнее понять "что я
 * получу", чем прочитать таблицу технических чекбоксов. Горизонтальный
 * скролл на узких экранах — обычный `overflow-x: auto` с глобальным CSS-
 * фолбэком (см. AGENTS.md, "случайные переполнения"), не `ScrollArea` (та
 * заточена под вертикальный скролл списков, не под таблицы). */
export function GrowthComparisonTable() {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Growth &amp; Advertising — сравнение тарифов</h2>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.table__headCorner} scope="col">
                Возможность
              </th>
              {PLAN_CATALOG.map((plan) => (
                <th key={plan.tier} className={styles.table__headCol} scope="col">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROWTH_ADVERTISING_COMPARISON.map((row) => (
              <tr key={row.id}>
                <th className={styles.table__rowLabel} scope="row">
                  {row.label}
                </th>
                {PLAN_CATALOG.map((plan) => {
                  const level = row.levels[plan.tier];
                  return (
                    <td
                      key={plan.tier}
                      className={cn(styles.table__cell, styles[`table__cell--${level}`])}
                    >
                      {LEVEL_LABELS[level]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
