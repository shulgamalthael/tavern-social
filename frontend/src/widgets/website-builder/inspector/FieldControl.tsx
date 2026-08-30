'use client';

import { useId } from 'react';
import type { DataSourceValue, FieldSchema, LinkTarget, WebsitePage } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { DataSourceField } from './DataSourceField';
import { ImageField } from './ImageField';
import { LinkField } from './LinkField';
import { ListField } from './ListField';
import styles from './FieldControl.module.scss';

export interface FieldControlProps {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  businessId: string;
  /** Скрывает подпись над контролом (кроме `toggle` — там подпись рядом с
   * переключателем, а не отдельной строкой) — компактный режим телефона/
   * планшета (`FieldGroup.tsx`) уже показывает название свойства в
   * дропдауне-переключателе прямо над этим контролом, повторять его здесь
   * было бы лишним. */
  hideLabel?: boolean;
  /** Только для `control: 'link'` (см. `LinkField.tsx`) — список страниц
   * документа, чтобы можно было выбрать ссылку на конкретную страницу этого
   * же сайта. Опционален и по умолчанию пуст — большинство полей вообще не
   * `link`, прокидывать список страниц им незачем. */
  pages?: WebsitePage[];
}

/** `image`/`list`/`link` не сводятся к одному `<input>`, с которым можно
 * связать подпись через `htmlFor`/`id` (см. `ImageField`/`ListField`/
 * `LinkField` — своя составная разметка с несколькими полями сразу),
 * поэтому для них подпись — обычный текст, не `<label>` без пары. */
function hasAssociatedControl(control: FieldSchema['control']): boolean {
  return (
    control !== 'toggle' &&
    control !== 'image' &&
    control !== 'list' &&
    control !== 'link' &&
    control !== 'dataSource'
  );
}

/**
 * Один элемент формы инспектора, выбирает конкретный UI-контрол по
 * `field.control` (см. `FieldSchema` в `entities/website/model/registry.ts`)
 * — единая точка ветвления вместо if/else в каждом месте, где рисуется
 * инспектор (`BlockInspectorForm.tsx`, `LayoutSection.tsx`, и рекурсивно
 * сам себя внутри `ListField.tsx` для полей элемента списка). Ничего не
 * знает про стор — только `value`/`onChange`, куда и как писать решает
 * вызывающий (`props` блока напрямую, `props` с responsive-обёрткой, или
 * `style` блока — см. `BlockInspectorForm.tsx`).
 */
export function FieldControl({
  field,
  value,
  onChange,
  businessId,
  hideLabel,
  pages,
}: FieldControlProps) {
  const fieldId = useId();

  return (
    <div className={styles.field}>
      {field.control !== 'toggle' &&
        !hideLabel &&
        (hasAssociatedControl(field.control) ? (
          <label htmlFor={fieldId} className={styles.field__label}>
            {field.label}
          </label>
        ) : (
          <span className={styles.field__label}>{field.label}</span>
        ))}

      {field.control === 'text' && (
        <input
          id={fieldId}
          type="text"
          className={styles.input}
          placeholder={field.placeholder}
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {(field.control === 'textarea' || field.control === 'richtext') && (
        <textarea
          id={fieldId}
          className={styles.textarea}
          rows={field.control === 'textarea' ? (field.rows ?? 3) : 6}
          placeholder={field.control === 'textarea' ? field.placeholder : undefined}
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.control === 'number' && (
        <div className={styles.numberRow}>
          <input
            id={fieldId}
            type="number"
            className={cn(styles.input, styles['input--inline'])}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={(value as number | undefined) ?? ''}
            onChange={(event) =>
              onChange(event.target.value === '' ? undefined : Number(event.target.value))
            }
          />
          {field.suffix && <span className={styles.suffix}>{field.suffix}</span>}
        </div>
      )}

      {field.control === 'select' && (
        <select
          id={fieldId}
          className={styles.select}
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.control === 'color' && (
        <div className={styles.colorRow}>
          <input
            type="color"
            className={styles.colorSwatch}
            aria-label={field.label}
            value={/^#[0-9a-fA-F]{6}$/.test(value as string) ? (value as string) : '#2563eb'}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            id={fieldId}
            type="text"
            className={cn(styles.input, styles['input--inline'])}
            value={(value as string | undefined) ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}

      {field.control === 'toggle' && (
        <label className={styles.toggle}>
          <span className={styles.toggle__switch}>
            <input
              type="checkbox"
              className={styles.toggle__input}
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span
              className={cn(
                styles.toggle__track,
                Boolean(value) && styles['toggle__track--checked'],
              )}
            />
          </span>
          <span className={styles.toggle__label}>{field.label}</span>
        </label>
      )}

      {field.control === 'url' && (
        <input
          id={fieldId}
          type="url"
          className={styles.input}
          placeholder="https://…"
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.control === 'image' && (
        <ImageField
          value={(value as string | null | undefined) ?? null}
          onChange={onChange}
          businessId={businessId}
        />
      )}

      {field.control === 'link' && (
        <LinkField
          value={value as LinkTarget | undefined}
          onChange={onChange}
          pages={pages ?? []}
          businessId={businessId}
          actionsEnabled={field.actionsEnabled}
        />
      )}

      {field.control === 'dataSource' && (
        <DataSourceField
          value={value as DataSourceValue}
          onChange={onChange}
          entity={field.entity}
        />
      )}

      {field.control === 'list' && (
        <ListField
          field={field}
          value={(value as Record<string, unknown>[] | undefined) ?? []}
          onChange={onChange}
          businessId={businessId}
          pages={pages}
        />
      )}

      {field.hint && field.control !== 'toggle' && (
        <p className={styles.field__hint}>{field.hint}</p>
      )}
    </div>
  );
}
