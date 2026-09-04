'use client';

import type { FieldSchema, WebsitePage } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { FieldControl } from './FieldControl';
import styles from './FieldGroup.module.scss';

export interface FieldGroupItem {
  field: FieldSchema;
  value: unknown;
  onChange: (next: unknown) => void;
}

export interface FieldGroupProps {
  items: FieldGroupItem[];
  businessId: string;
  /** Какие контролы растягивать на всю ширину сетки (см.
   * `BlockInspectorForm.tsx`); `LayoutSection` не передаёт, там все поля
   * короткие. На телефоне/планшете (одна колонка, см. `.module.scss`)
   * ничего не делает — там и так всё на всю ширину. */
  wideControls?: Set<FieldSchema['control']>;
  /** Прокидывается дальше в `FieldControl` для полей с `control: 'link'` —
   * см. её комментарий. */
  pages?: WebsitePage[];
}

/**
 * Список полей формы инспектора — общий для `BlockInspectorForm.tsx`
 * (собственные поля блока) и `LayoutSection.tsx` (общая секция «Отступы и
 * фон»). Один рендер на любой ширине экрана — многоколоночная сетка на
 * десктопе, та же сетка в одну колонку на телефоне/планшете (чистый CSS,
 * `@include mobileOrTablet` в `.module.scss`, без JS-ветвления).
 *
 * Раньше на телефоне/планшете здесь был отдельный «компактный» режим —
 * дропдаун «какое свойство настроить» + один контрол под ним, вместо всех
 * полей сразу (осознанное решение из более ранней задачи). Заменено на
 * простой вертикальный список — так это делают все топ-конкуренты (Wix/
 * Framer/Webflow/Notion: мобильные настройки — обычный скролл всех полей
 * подряд, без выбора из списка) — и заодно упрощает сам компонент: был один
 * путь рендера на десктопе и второй, с собственным состоянием выбранного
 * поля, на телефоне — остался один.
 */
export function FieldGroup({ items, businessId, wideControls, pages }: FieldGroupProps) {
  if (items.length === 0) return null;

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
