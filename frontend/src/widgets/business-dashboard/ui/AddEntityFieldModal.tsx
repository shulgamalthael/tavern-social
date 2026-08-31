'use client';

import { useState, type FormEvent } from 'react';
import {
  addCustomEntityField,
  CUSTOM_ENTITY_FIELD_TYPES,
  CUSTOM_ENTITY_FIELD_TYPE_LABELS,
  type CustomEntity,
  type CustomEntityFieldType,
} from '@/entities/custom-entity';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import styles from './RuleFormModal.module.scss';

export interface AddEntityFieldModalProps {
  businessId: string;
  entity: CustomEntity;
  onSaved: (entity: CustomEntity) => void;
  onClose: () => void;
}

const KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;

/** Добавляет РОВНО одно новое поле к уже существующей сущности — тот же
 * additive-only принцип, что `add_field` на backend. Отдельная маленькая
 * форма от `CustomEntityFormModal` (которая создаёт сущность целиком) —
 * намеренно не одна универсальная форма "создать/редактировать", потому что
 * у "добавить поле" другой набор ограничений (ключ не должен совпадать с уже
 * существующими на этой сущности, показанными здесь же для подсказки). */
export function AddEntityFieldModal({
  businessId,
  entity,
  onSaved,
  onClose,
}: AddEntityFieldModalProps) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomEntityFieldType>('string');
  const [required, setRequired] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingKeys = entity.fields.map((field) => field.key);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!KEY_PATTERN.test(key)) {
      setError('Ключ должен начинаться с буквы и содержать только латиницу/цифры/подчёркивание');
      return;
    }
    if (existingKeys.includes(key)) {
      setError(`Поле с ключом "${key}" уже существует на этой сущности`);
      return;
    }
    if (!label.trim()) {
      setError('Введите название поля');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await addCustomEntityField(businessId, entity.id, {
        key,
        label: label.trim(),
        type,
        required,
      });
      onSaved(updated);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось добавить поле');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Новое поле" className={styles.modal}>
      <h2 className={styles.title}>Новое поле — «{entity.name}»</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <p className={styles.hint}>
          Уже существуют: {existingKeys.length > 0 ? existingKeys.join(', ') : '—'}. Существующие
          поля нельзя удалить или переименовать — только добавить новое.
        </p>

        <label className={styles.field}>
          <span className={styles.label}>Ключ</span>
          <input
            type="text"
            className={styles.input}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="notes"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Заметки"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Тип</span>
          <select
            className={styles.input}
            value={type}
            onChange={(event) => setType(event.target.value as CustomEntityFieldType)}
          >
            {CUSTOM_ENTITY_FIELD_TYPES.map((fieldType) => (
              <option key={fieldType} value={fieldType}>
                {CUSTOM_ENTITY_FIELD_TYPE_LABELS[fieldType]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
          />
          <span>Обязательное поле</span>
        </label>

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
            {isSubmitting ? 'Добавляем…' : 'Добавить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
