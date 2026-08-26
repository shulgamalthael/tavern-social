'use client';

import { useState } from 'react';
import type { FieldSchema, WebsitePage } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { useMediaQuery } from '@/shared/lib/use-media-query';
import { FieldControl } from './FieldControl';
import styles from './FieldGroup.module.scss';

export interface FieldGroupItem {
  field: FieldSchema;
  value: unknown;
  onChange: (next: unknown) => void;
}

export interface FieldGroupProps {
  /** Сбрасывает выбранное в дропдауне свойство при смене — id блока, чьи
   * поля сейчас показаны. Без сброса при переключении на другой блок в
   * компактном режиме остался бы выбран пункт с тем же порядковым номером,
   * а не тем же смыслом (см. `autoPanedFor` в `WebsiteBuilderWidget.tsx` —
   * тот же приём: сравнение во время рендера вместо эффекта). */
  resetKey: string;
  items: FieldGroupItem[];
  businessId: string;
  /** Только для десктопной сетки — какие контролы растягивать на всю
   * ширину (см. `BlockInspectorForm.tsx`); `LayoutSection` не передаёт, там
   * все поля короткие. */
  wideControls?: Set<FieldSchema['control']>;
  /** Прокидывается дальше в `FieldControl` для полей с `control: 'link'` —
   * см. её комментарий. */
  pages?: WebsitePage[];
}

// Держать в синхроне с `@mixin mobileOrTablet` (`shared/styles/_mixins.scss`,
// `$bp-tablet: 1024px`) — то же пороговое значение, что и вся остальная
// адаптивная вёрстка билдера.
const COMPACT_QUERY = '(max-width: 1023px)';

/**
 * Список полей формы инспектора — общий для `BlockInspectorForm.tsx`
 * (собственные поля блока) и `LayoutSection.tsx` (общая секция «Отступы и
 * фон»): на десктопе как раньше, сеткой (курсор и широкий экран позволяют
 * показать все поля сразу — там「на десктопе всё идеально」и трогать нечего).
 * На телефоне/планшете — компактно: дропдаун выбирает ОДНО свойство за раз,
 * под ним его единственный контрол, вместо длинного списка всех полей
 * сразу — это и есть ответ на «настройки дропдауном» из корневого плана
 * задачи. Контрол рендерится тут же, не в отдельном попапе — попап поверх
 * канваса решал бы проблему видимости изменений «в реальном времени»,
 * которой после редизайна панели в раскладную (не полноэкранную) уже нет:
 * холст остаётся виден под панелью настроек в обоих случаях.
 */
export function FieldGroup({ resetKey, items, businessId, wideControls, pages }: FieldGroupProps) {
  const isCompact = useMediaQuery(COMPACT_QUERY);
  const [trackedResetKey, setTrackedResetKey] = useState(resetKey);
  const [selectedKey, setSelectedKey] = useState<string | null>(items[0]?.field.key ?? null);
  if (trackedResetKey !== resetKey) {
    setTrackedResetKey(resetKey);
    setSelectedKey(items[0]?.field.key ?? null);
  }

  if (items.length === 0) return null;

  if (!isCompact) {
    return (
      <div className={styles.grid}>
        {items.map(({ field, value, onChange }) => (
          <div
            key={field.key}
            className={cn(styles.slot, wideControls?.has(field.control) && styles['slot--wide'])}
          >
            <FieldControl
              field={field}
              value={value}
              businessId={businessId}
              onChange={onChange}
              pages={pages}
            />
          </div>
        ))}
      </div>
    );
  }

  const selected = items.find((item) => item.field.key === selectedKey) ?? items[0];

  return (
    <div className={styles.compact}>
      <select
        className={styles.compact__select}
        value={selected.field.key}
        onChange={(event) => setSelectedKey(event.target.value)}
        aria-label="Какое свойство настроить"
      >
        {items.map(({ field }) => (
          <option key={field.key} value={field.key}>
            {field.label}
          </option>
        ))}
      </select>
      <div className={styles.compact__control}>
        <FieldControl
          field={selected.field}
          value={selected.value}
          businessId={businessId}
          onChange={selected.onChange}
          hideLabel
          pages={pages}
        />
      </div>
    </div>
  );
}
