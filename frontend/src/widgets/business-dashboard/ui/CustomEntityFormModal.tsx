'use client';

import { useState, type FormEvent } from 'react';
import {
  createCustomEntity,
  CUSTOM_ENTITY_FIELD_TYPES,
  CUSTOM_ENTITY_FIELD_TYPE_LABELS,
  type CustomEntity,
  type CustomEntityFieldType,
} from '@/entities/custom-entity';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { PlusIcon, TrashIcon } from '@/shared/ui/icons';
import styles from './RuleFormModal.module.scss';

export interface CustomEntityFormModalProps {
  businessId: string;
  onSaved: (entity: CustomEntity) => void;
  onClose: () => void;
}

interface DraftField {
  key: string;
  label: string;
  type: CustomEntityFieldType;
  required: boolean;
}

const KEY_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;

function makeEmptyField(): DraftField {
  return { key: '', label: '', type: 'string', required: false };
}

/**
 * Создаёт новую пользовательскую сущность (AI_PLATFORM_ROADMAP.md §2.2/§19,
 * AI-8 первый ограниченный слайс) — название + начальный набор полей. Только
 * создание, не редактирование: поля существующей сущности можно только
 * ДОБАВЛЯТЬ (`AddEntityFieldModal`, отдельная маленькая форма из карточки
 * записей), не менять этой формой — та же "additive, не migration"
 * дисциплина, что и на backend (`CustomEntitiesService.addField`'s
 * комментарий). Переиспользует разметку/стили `RuleFormModal` — та же форма
 * "поле + кнопка добавить/убрать строку", что у списка условий правила.
 */
export function CustomEntityFormModal({
  businessId,
  onSaved,
  onClose,
}: CustomEntityFormModalProps) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<DraftField[]>([makeEmptyField()]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(index: number, patch: Partial<DraftField>) {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  }

  function addField() {
    setFields((prev) => [...prev, makeEmptyField()]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название сущности');
      return;
    }
    if (fields.length === 0) {
      setError('Добавьте хотя бы одно поле');
      return;
    }

    const keys = new Set<string>();
    for (const field of fields) {
      if (!KEY_PATTERN.test(field.key)) {
        setError(
          `Ключ поля "${field.key || '(пусто)'}" должен начинаться с буквы и содержать только латиницу/цифры/подчёркивание`,
        );
        return;
      }
      if (keys.has(field.key)) {
        setError(`Ключ "${field.key}" повторяется — у каждого поля должен быть свой ключ`);
        return;
      }
      keys.add(field.key);
      if (!field.label.trim()) {
        setError('Заполните название для каждого поля');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const entity = await createCustomEntity(businessId, {
        name: name.trim(),
        fields: fields.map((field) => ({
          key: field.key,
          label: field.label.trim(),
          type: field.type,
          required: field.required,
        })),
      });
      onSaved(entity);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать сущность');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Новая сущность" className={styles.modal}>
      <h2 className={styles.title}>Новая сущность</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Клиенты CRM"
            autoFocus
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Поля</span>
          <div className={styles.conditions}>
            {fields.map((field, index) => (
              <div key={index} className={styles.condition}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Ключ, например customerName"
                  value={field.key}
                  onChange={(event) => updateField(index, { key: event.target.value })}
                />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Название"
                  value={field.label}
                  onChange={(event) => updateField(index, { label: event.target.value })}
                />
                <select
                  className={styles.input}
                  value={field.type}
                  onChange={(event) =>
                    updateField(index, { type: event.target.value as CustomEntityFieldType })
                  }
                >
                  {CUSTOM_ENTITY_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CUSTOM_ENTITY_FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.condition__remove}
                  aria-label="Убрать поле"
                  onClick={() => removeField(index)}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addField}>
              <PlusIcon />
              Добавить поле
            </Button>
          </div>
        </div>

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
            {isSubmitting ? 'Создаём…' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
