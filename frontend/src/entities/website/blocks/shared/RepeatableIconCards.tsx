import type { CSSProperties } from 'react';
import { resolveIconChoice } from './icon-choices';
import { SectionHeading } from './SectionHeading';
import styles from './primitives.module.scss';

export interface IconCardItem {
  icon?: string;
  title: string;
  description: string;
}

export interface RepeatableIconCardsProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  items: IconCardItem[];
  columns?: number;
}

/** Сетка «иконка + заголовок + текст» — общий движок `services` и
 * `featuregrid` (структурно один и тот же блок, разные дефолты и место в
 * каталоге, см. `blocks/business/index.tsx`/`blocks/content/index.tsx`). */
export function RepeatableIconCards({
  eyebrow,
  heading,
  description,
  items,
  columns = 3,
}: RepeatableIconCardsProps) {
  return (
    <div className={styles.block}>
      <SectionHeading eyebrow={eyebrow} heading={heading} description={description} />
      <div className={styles['icon-grid']} style={{ '--grid-columns': columns } as CSSProperties}>
        {items.map((item, index) => {
          const Icon = resolveIconChoice(item.icon);
          return (
            <div key={index} className={styles['icon-card']}>
              <span className={styles['icon-card__icon']}>
                <Icon />
              </span>
              <h3 className={styles['icon-card__title']}>{item.title}</h3>
              {item.description && (
                <p className={styles['icon-card__description']}>{item.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
