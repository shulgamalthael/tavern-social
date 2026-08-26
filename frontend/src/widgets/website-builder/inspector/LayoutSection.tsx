'use client';

import {
  BACKGROUND_OPTIONS,
  CONTAINER_WIDTH_OPTIONS,
  SPACING_SIZE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  type BlockStyle,
  type FieldSchema,
} from '@/entities/website';
import { FieldGroup } from './FieldGroup';
import styles from './LayoutSection.module.scss';

const STYLE_FIELDS: FieldSchema[] = [
  { key: 'background', label: 'Фон', control: 'select', options: BACKGROUND_OPTIONS },
  {
    key: 'paddingY',
    label: 'Отступы сверху/снизу',
    control: 'select',
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'paddingX',
    label: 'Отступы слева/справа',
    control: 'select',
    options: SPACING_SIZE_OPTIONS,
  },
  { key: 'marginTop', label: 'Отступ до блока', control: 'select', options: SPACING_SIZE_OPTIONS },
  {
    key: 'marginBottom',
    label: 'Отступ после блока',
    control: 'select',
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'textAlign',
    label: 'Выравнивание текста',
    control: 'select',
    options: TEXT_ALIGN_OPTIONS,
  },
  {
    key: 'maxWidth',
    label: 'Ширина контента',
    control: 'select',
    options: CONTAINER_WIDTH_OPTIONS,
  },
];

export interface LayoutSectionProps {
  /** Id блока, чей стиль сейчас показан — сбрасывает выбранное свойство в
   * компактном дропдауне при переключении на другой блок (см.
   * `FieldGroup.tsx`, `resetKey`). */
  blockId: string;
  style: BlockStyle | undefined;
  onChange: (patch: BlockStyle) => void;
  businessId: string;
}

/**
 * Секция «Отступы и фон» — общая для ЛЮБОГО блока (см. `BlockStyle` в
 * `entities/website/model/types.ts`), поэтому не часть `definition.fields`
 * конкретного блока, а собственный фиксированный список полей здесь,
 * отрисованный теми же `FieldControl`, что и обычные поля блока (см.
 * `BlockInspectorForm.tsx`). Значения не responsive — `BlockStyle`
 * применяется одинаково на всех вьюпортах (см. `computeBlockWrapperStyle`).
 */
export function LayoutSection({ blockId, style, onChange, businessId }: LayoutSectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.section__title}>Отступы и фон</h3>
      <FieldGroup
        resetKey={blockId}
        businessId={businessId}
        items={STYLE_FIELDS.map((field) => ({
          field,
          value: (style as Record<string, unknown> | undefined)?.[field.key],
          onChange: (next: unknown) => onChange({ [field.key]: next } as BlockStyle),
        }))}
      />
    </div>
  );
}
