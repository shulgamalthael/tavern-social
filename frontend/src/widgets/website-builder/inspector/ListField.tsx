'use client';

import { useState } from 'react';
import type { FieldSchema, WebsitePage } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { defaultListItem } from './field-defaults';
import { FieldControl } from './FieldControl';
import styles from './ListField.module.scss';

type ListFieldSchema = Extract<FieldSchema, { control: 'list' }>;

export interface ListFieldProps {
  field: ListFieldSchema;
  value: Record<string, unknown>[];
  onChange: (value: Record<string, unknown>[]) => void;
  businessId: string;
  /** Прокидывается дальше в `FieldControl` для `itemFields` с `control:
   * 'link'` (например, ссылки навигации) — см. `FieldControl.tsx`. */
  pages?: WebsitePage[];
}

/**
 * Повторяемый список объектов (`control: 'list'` в `FieldSchema`) —
 * карточки/пункты меню/ссылки соцсетей и т. п. Каждый элемент раскрывается
 * в свой набор `itemFields`, отрисованных теми же `FieldControl`, что и
 * поля верхнего уровня (см. `BlockInspectorForm.tsx`) — рекурсия схемы, а
 * не отдельная форма на каждый тип списка. Порядок меняется кнопками
 * вверх/вниз, а не drag & drop — в отличие от канваса (см. `Canvas.tsx`),
 * тут это не отдельный `DndContext`, ради простоты одной короткой формы.
 */
export function ListField({ field, value, onChange, businessId, pages }: ListFieldProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(value.length > 0 ? 0 : null);
  const atMax = field.max !== undefined && value.length >= field.max;

  function updateItem(index: number, patch: Record<string, unknown>) {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
    setOpenIndex(null);
  }

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= value.length) return;
    const next = [...value];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
    setOpenIndex(targetIndex);
  }

  function addItem() {
    onChange([...value, defaultListItem(field.itemFields)]);
    setOpenIndex(value.length);
  }

  return (
    <div className={styles.list}>
      {value.map((item, index) => {
        const isOpen = openIndex === index;
        const title =
          (item.title as string) || (item.name as string) || `${field.itemLabel} ${index + 1}`;

        return (
          <div key={index} className={styles.item}>
            <div className={styles.item__header}>
              <button
                type="button"
                className={styles.item__toggle}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                <span className={styles.item__title}>{title}</span>
              </button>
              <div className={styles.item__actions}>
                <button
                  type="button"
                  className={styles.item__action}
                  aria-label="Переместить выше"
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                >
                  <ChevronUpIcon />
                </button>
                <button
                  type="button"
                  className={styles.item__action}
                  aria-label="Переместить ниже"
                  disabled={index === value.length - 1}
                  onClick={() => moveItem(index, 1)}
                >
                  <ChevronDownIcon />
                </button>
                <button
                  type="button"
                  className={cn(styles.item__action, styles['item__action--danger'])}
                  aria-label="Удалить"
                  onClick={() => removeItem(index)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className={styles.item__body}>
                {field.itemFields.map((itemField) => (
                  <FieldControl
                    key={itemField.key}
                    field={itemField}
                    value={item[itemField.key]}
                    onChange={(next) => updateItem(index, { [itemField.key]: next })}
                    businessId={businessId}
                    pages={pages}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className={styles.add} disabled={atMax} onClick={addItem}>
        <PlusIcon />
        Добавить {field.itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
