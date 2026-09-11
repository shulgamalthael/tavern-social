'use client';

import { useState } from 'react';
import type { WidgetFieldSchema } from '@/entities/custom-widget';
import { type FieldSchema, useWebsiteBuilderStore } from '@/entities/website';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { FieldControl } from '../inspector/FieldControl';
import styles from './WidgetFieldValuesModal.module.scss';

/** Переводит параметр виджета (`WidgetFieldSchema`, узкий набор `kind` —
 * string/number/boolean/enum/mediaAsset/linkTarget) в контрол инспектора
 * (`FieldSchema`, `entities/website/model/registry.ts`) — переиспользует
 * готовые `FieldControl`/`ImageField`/`LinkField`, а не рисует свою форму
 * заново. Без `maxLength` на `text`/`textarea` — `FieldSchema` этого поля не
 * знает вообще (проверено, HTML-атрибут `maxLength` нигде в `FieldControl`
 * не проставляется даже для обычных пропсов блока), тот же уровень строгости
 * везде в билдере: длину проверяет backend, инспектор — нет. */
function toFieldSchema(field: WidgetFieldSchema): FieldSchema {
  switch (field.kind) {
    case 'number':
      return {
        key: field.key,
        label: field.label,
        control: 'number',
        min: field.min,
        max: field.max,
      };
    case 'boolean':
      return { key: field.key, label: field.label, control: 'toggle' };
    case 'enum':
      return {
        key: field.key,
        label: field.label,
        control: 'select',
        options: (field.values ?? []).map((value) => ({ value, label: value })),
      };
    case 'mediaAsset':
      return { key: field.key, label: field.label, control: 'image' };
    case 'linkTarget':
      return { key: field.key, label: field.label, control: 'link' };
    case 'string':
    default:
      return { key: field.key, label: field.label, control: 'text' };
  }
}

function defaultValueFor(kind: WidgetFieldSchema['kind']): unknown {
  switch (kind) {
    case 'boolean':
      return false;
    case 'mediaAsset':
      return null;
    default:
      return undefined;
  }
}

export interface WidgetFieldValuesModalProps {
  widgetName: string;
  fields: WidgetFieldSchema[];
  businessId: string;
  onConfirm: (values: Record<string, unknown>) => void;
  onClose: () => void;
}

/**
 * Виджеты общего каталога (и «Мои виджеты» с параметрами, §62.1) теперь
 * обычно несут `{{fieldKey}}`-плейсхолдеры вместо готового текста/ссылок
 * (AI_PLATFORM_ROADMAP.md §76 — «болванки»): вставка кликом («Мои виджеты»/
 * «Каталог виджетов», `ComponentLibraryPanel.tsx`) без этого шага воткнула
 * бы на страницу буквальные строки `{{headline}}`. Эта модалка — недостающее
 * звено: собирает реальные значения параметров ПЕРЕД вызовом
 * `insertWidgetBlocks`, у AI-пути (`insert_custom_widget`) для этого есть
 * `values`, здесь — обычная форма.
 *
 * Только UX-валидация (обязательность поля) — не дублирует backend's
 * `validateOneField`: вставка виджета в билдере — такое же клиентское
 * редактирование ДОКУМЕНТА СВОЕГО ЖЕ бизнеса, как и любое другое действие
 * `website-store.ts`, backend не проверяет пропсы блоков курированной схемой
 * вне AI-путей (см. `resolve-widget-field-values.ts`'s комментарий).
 */
export function WidgetFieldValuesModal({
  widgetName,
  fields,
  businessId,
  onConfirm,
  onClose,
}: WidgetFieldValuesModalProps) {
  const pages = useWebsiteBuilderStore((state) => state.document?.pages);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of fields) {
      const defaultValue = defaultValueFor(field.kind);
      if (defaultValue !== undefined) initial[field.key] = defaultValue;
    }
    return initial;
  });

  const isComplete = fields.every((field) => {
    const value = values[field.key];
    if (field.kind === 'boolean' || field.kind === 'mediaAsset') return true;
    return value !== undefined && value !== null && value !== '';
  });

  return (
    <Modal onClose={onClose} label={`Параметры виджета «${widgetName}»`} className={styles.modal}>
      <h2 className={styles.title}>Заполните параметры виджета «{widgetName}»</h2>
      <p className={styles.hint}>
        Этот виджет — заготовка из общего каталога: текст и ссылки нужно указать самим, они не
        приходят вместе с виджетом.
      </p>

      <div className={styles.form}>
        {fields.map((field) => (
          <FieldControl
            key={field.key}
            field={toFieldSchema(field)}
            value={values[field.key]}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
            businessId={businessId}
            pages={pages}
          />
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onClose}>
          Отмена
        </button>
        <Button disabled={!isComplete} onClick={() => onConfirm(values)}>
          Вставить виджет
        </Button>
      </div>
    </Modal>
  );
}
