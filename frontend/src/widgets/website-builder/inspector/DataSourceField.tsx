'use client';

import type { DataSourceValue } from '@/entities/website';
import styles from './DataSourceField.module.scss';

export interface DataSourceFieldProps {
  value: DataSourceValue;
  onChange: (value: DataSourceValue) => void;
  entity: 'product' | 'service' | 'post';
}

const ENTITY_LABELS: Record<DataSourceFieldProps['entity'], string> = {
  product: 'товаров',
  service: 'услуг',
  post: 'постов',
};

const SORT_OPTIONS: { value: DataSourceValue['sort']; label: string }[] = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
];

/**
 * Контрол для `control: 'dataSource'` — сейчас только «сколько показать» и
 * «в каком порядке», без выбора КАКИХ товаров (нет ни `Category`, ни ручного
 * выбора конкретных элементов, см. комментарий `DataSourceValue` в `model/
 * types.ts` — узкий v1). Имени сущности здесь всё же нет отдельным полем —
 * оно уже зафиксировано в схеме поля блока (`field.entity`, см. `FieldControl.
 * tsx`), меняться в рантайме не может, показывать его как ещё один выбор было
 * бы шумом; используется только чтобы подписать число (`N товаров`/`N услуг`/
 * `N постов`) и скрыть сортировку по цене там, где цены вообще нет (`post`,
 * см. комментарий модели `BlogPost` на backend — у поста нет `priceCents`).
 */
export function DataSourceField({ value, onChange, entity }: DataSourceFieldProps) {
  const sortOptions =
    entity === 'post' ? SORT_OPTIONS.filter((o) => o.value === 'newest') : SORT_OPTIONS;

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <span className={styles.label}>Показывать</span>
        <input
          type="number"
          min={1}
          max={24}
          className={styles.numberInput}
          value={value.limit}
          onChange={(event) =>
            onChange({ ...value, limit: Math.max(1, Number(event.target.value) || 1) })
          }
        />
        <span className={styles.label}>{ENTITY_LABELS[entity]}</span>
      </div>

      {sortOptions.length > 1 && (
        <select
          className={styles.select}
          value={value.sort}
          onChange={(event) =>
            onChange({ ...value, sort: event.target.value as DataSourceValue['sort'] })
          }
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
