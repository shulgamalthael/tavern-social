'use client';

import { useState } from 'react';
import type { GrowthStrategy } from '@/entities/subscription';
import { cn } from '@/shared/lib/cn';
import { ChevronDownIcon } from '@/shared/ui/icons';
import styles from './GrowthStrategyPanel.module.scss';

export interface GrowthStrategyPanelProps {
  strategy: GrowthStrategy;
}

/** "YOUR GROWTH STRATEGY" — готовый путь роста бизнеса на тарифе, не список
 * фич (см. §2/§12/§13 исходного brief'а "Growth Strategy"): заголовок этапа
 * виден сразу, описание раскрывается по клику — тот же интерактивный
 * accordion-паттерн, что просил brief ("hover/click → раскрыть этап"), без
 * лишней библиотеки под одну карточку. */
export function GrowthStrategyPanel({ strategy }: GrowthStrategyPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className={styles.root}>
      <p className={styles.title}>{strategy.title}</p>
      <ol className={styles.stages}>
        {strategy.stages.map((stage, index) => {
          const isExpanded = expandedId === stage.id;
          return (
            <li key={stage.id} className={styles.stage}>
              <button
                type="button"
                className={styles.stage__header}
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : stage.id)}
              >
                <span className={styles.stage__number}>{index + 1}</span>
                <span className={styles.stage__title}>{stage.title}</span>
                <ChevronDownIcon
                  className={cn(
                    styles.stage__chevron,
                    isExpanded && styles['stage__chevron--open'],
                  )}
                />
              </button>
              {isExpanded && <p className={styles.stage__description}>{stage.description}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
