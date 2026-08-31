'use client';

import { useState, type FormEvent } from 'react';
import {
  createCustomWidget,
  updateCustomWidget,
  WIDGET_BLOCK_FIELD_LABELS,
  WIDGET_BLOCK_SCHEMAS,
  WIDGET_BLOCK_TYPES,
  type CustomWidget,
  type CustomWidgetStatus,
  type WidgetBlockInput,
  type WidgetBlockType,
} from '@/entities/custom-widget';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { PlusIcon, TrashIcon } from '@/shared/ui/icons';
import styles from './WidgetFormModal.module.scss';

export interface WidgetFormModalProps {
  businessId: string;
  /** `null` — создание нового виджета, иначе — редактирование существующего. */
  widget: CustomWidget | null;
  onSaved: () => void;
  onClose: () => void;
}

function makeDefaultBlock(blockType: WidgetBlockType): WidgetBlockInput {
  return { blockType, props: { ...WIDGET_BLOCK_SCHEMAS[blockType].defaultProps } };
}

/**
 * Строит и редактирует `CustomWidget.schema` (AI_PLATFORM_ROADMAP.md §2.4/
 * §14/§16.2) — те же 4 curated типа блоков, что AI-2's `add_block`
 * (`WIDGET_BLOCK_SCHEMAS`, зеркало backend's `BLOCK_SCHEMAS`), по одной и
 * той же причине: расширять allowlist имеет смысл вместе с новыми
 * возможностями (медиа/ссылки), не раньше. В отличие от `RuleFormModal`
 * (которая может встретить условие, созданное не собой, и не умеет его
 * отобразить-и-сохранить нетронутым), здесь такой проблемы нет — backend
 * ФИЗИЧЕСКИ не может сохранить блок вне этой allowlist (`parseWidgetSchema`
 * отклоняет всё остальное на записи), так что любой существующий виджет
 * гарантированно состоит только из типов, которые эта форма умеет
 * редактировать.
 */
export function WidgetFormModal({ businessId, widget, onSaved, onClose }: WidgetFormModalProps) {
  const [name, setName] = useState(widget?.name ?? '');
  const [widgetStatus, setWidgetStatus] = useState<CustomWidgetStatus>(widget?.status ?? 'draft');
  const [blocks, setBlocks] = useState<WidgetBlockInput[]>(
    () =>
      widget?.schema.map((block) => ({ blockType: block.type, props: { ...block.props } })) ?? [
        makeDefaultBlock('heading'),
      ],
  );
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateBlockType(index: number, blockType: WidgetBlockType) {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? makeDefaultBlock(blockType) : block)),
    );
  }

  function updateBlockField(index: number, field: string, value: string) {
    setBlocks((prev) =>
      prev.map((block, i) =>
        i === index ? { ...block, props: { ...block.props, [field]: value } } : block,
      ),
    );
  }

  function addBlock() {
    setBlocks((prev) => [...prev, makeDefaultBlock('heading')]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название виджета');
      return;
    }
    if (blocks.length === 0) {
      setError('Добавьте хотя бы один блок');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (widget) {
        await updateCustomWidget(businessId, widget.id, {
          name: name.trim(),
          schema: blocks,
          status: widgetStatus,
        });
      } else {
        await createCustomWidget(businessId, { name: name.trim(), schema: blocks });
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить виджет');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={widget ? 'Редактировать виджет' : 'Новый виджет'}
      className={styles.modal}
    >
      <h2 className={styles.title}>{widget ? 'Редактировать виджет' : 'Новый виджет'}</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Блок с контактами"
            autoFocus
          />
        </label>

        {widget && (
          <label className={styles.field}>
            <span className={styles.label}>Статус</span>
            <select
              className={styles.input}
              value={widgetStatus}
              onChange={(event) => setWidgetStatus(event.target.value as CustomWidgetStatus)}
            >
              <option value="draft">Черновик</option>
              <option value="published">Опубликован</option>
            </select>
            <span className={styles.hint}>
              Пока не влияет на публичный сайт — виджет ещё нигде не встраивается на страницы.
            </span>
          </label>
        )}

        <div className={styles.field}>
          <span className={styles.label}>Блоки</span>
          <div className={styles.blocks}>
            {blocks.map((block, index) => {
              const schema = WIDGET_BLOCK_SCHEMAS[block.blockType];
              return (
                <div key={index} className={styles.block}>
                  <div className={styles.block__header}>
                    <select
                      className={`${styles.input} ${styles.block__type}`}
                      value={block.blockType}
                      onChange={(event) =>
                        updateBlockType(index, event.target.value as WidgetBlockType)
                      }
                    >
                      {WIDGET_BLOCK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {WIDGET_BLOCK_SCHEMAS[type].label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.block__remove}
                      aria-label="Удалить блок"
                      onClick={() => removeBlock(index)}
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  <div className={styles.block__fields}>
                    {Object.entries(schema.fields).map(([fieldKey, fieldSchema]) => {
                      const value = block.props[fieldKey] ?? '';
                      const fieldLabel = WIDGET_BLOCK_FIELD_LABELS[fieldKey] ?? fieldKey;

                      if (fieldSchema.kind === 'enum') {
                        return (
                          <label key={fieldKey} className={styles.field}>
                            <span className={styles.label}>{fieldLabel}</span>
                            <select
                              className={styles.input}
                              value={value}
                              onChange={(event) =>
                                updateBlockField(index, fieldKey, event.target.value)
                              }
                            >
                              {fieldSchema.values?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }

                      const isLong = (fieldSchema.maxLength ?? 0) > 300;
                      return (
                        <label key={fieldKey} className={styles.field}>
                          <span className={styles.label}>{fieldLabel}</span>
                          {isLong ? (
                            <textarea
                              className={styles.textarea}
                              value={value}
                              maxLength={fieldSchema.maxLength}
                              onChange={(event) =>
                                updateBlockField(index, fieldKey, event.target.value)
                              }
                            />
                          ) : (
                            <input
                              type="text"
                              className={styles.input}
                              value={value}
                              maxLength={fieldSchema.maxLength}
                              onChange={(event) =>
                                updateBlockField(index, fieldKey, event.target.value)
                              }
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" onClick={addBlock}>
              <PlusIcon />
              Добавить блок
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
            {isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
