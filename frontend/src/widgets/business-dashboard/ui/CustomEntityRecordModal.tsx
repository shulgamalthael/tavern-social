'use client';

import { useState, type FormEvent } from 'react';
import {
  createCustomEntityRecord,
  updateCustomEntityRecord,
  type CustomEntity,
  type CustomEntityRecord,
  type CustomEntityRecordValue,
} from '@/entities/custom-entity';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import styles from './RuleFormModal.module.scss';

export interface CustomEntityRecordModalProps {
  businessId: string;
  entity: CustomEntity;
  /** `null` — создание новой записи, иначе — редактирование существующей. */
  record: CustomEntityRecord | null;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Форма записи данных, полностью построенная динамически из `entity.fields`
 * — то же "форма ведома схемой, не хардкодом" отличие Custom Database
 * Builder от обычных доменных форм (`RuleFormModal` и т.п. знают свои поля
 * заранее, эта — нет). `string`/`number`/`date` хранятся как строки в
 * локальном состоянии (естественный формат `<input>`), приводятся к
 * типизированному значению только на сабмите; `boolean` — свой checkbox,
 * всегда явное значение (не может быть "не задано" в форме, в отличие от
 * текстовых полей, которые можно оставить пустыми для необязательных).
 */
export function CustomEntityRecordModal({
  businessId,
  entity,
  record,
  onSaved,
  onClose,
}: CustomEntityRecordModalProps) {
  const [textValues, setTextValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of entity.fields) {
      if (field.type === 'boolean') continue;
      const value = record?.data[field.key];
      initial[field.key] = value === undefined ? '' : String(value);
    }
    return initial;
  });
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const field of entity.fields) {
      if (field.type !== 'boolean') continue;
      initial[field.key] = Boolean(record?.data[field.key] ?? false);
    }
    return initial;
  });

  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const data: Record<string, CustomEntityRecordValue> = {};
    for (const field of entity.fields) {
      if (field.type === 'boolean') {
        data[field.key] = boolValues[field.key] ?? false;
        continue;
      }

      const raw = (textValues[field.key] ?? '').trim();
      if (raw === '') {
        if (field.required) {
          setError(`Заполните «${field.label}»`);
          return;
        }
        continue;
      }

      if (field.type === 'number') {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          setError(`«${field.label}» должно быть числом`);
          return;
        }
        data[field.key] = parsed;
      } else if (field.type === 'date') {
        if (Number.isNaN(Date.parse(raw))) {
          setError(`«${field.label}» должно быть корректной датой`);
          return;
        }
        data[field.key] = raw;
      } else {
        data[field.key] = raw;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      if (record) {
        await updateCustomEntityRecord(businessId, entity.id, record.id, data);
      } else {
        await createCustomEntityRecord(businessId, entity.id, data);
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить запись');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={record ? 'Редактировать запись' : 'Новая запись'}
      className={styles.modal}
    >
      <h2 className={styles.title}>
        {record ? 'Редактировать запись' : 'Новая запись'} — «{entity.name}»
      </h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        {entity.fields.map((field) => (
          <label
            key={field.key}
            className={field.type === 'boolean' ? styles.toggle : styles.field}
          >
            {field.type === 'boolean' ? (
              <>
                <input
                  type="checkbox"
                  checked={boolValues[field.key] ?? false}
                  onChange={(event) =>
                    setBoolValues((prev) => ({ ...prev, [field.key]: event.target.checked }))
                  }
                />
                <span>{field.label}</span>
              </>
            ) : (
              <>
                <span className={styles.label}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <input
                  type={
                    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
                  }
                  className={styles.input}
                  value={textValues[field.key] ?? ''}
                  onChange={(event) =>
                    setTextValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              </>
            )}
          </label>
        ))}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
