'use client';

import { useState } from 'react';
import {
  BACKGROUND_OPTIONS,
  BLOCK_SHADOW_OPTIONS,
  BORDER_WIDTH_OPTIONS,
  CONTAINER_WIDTH_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  SPACING_PX,
  SPACING_SIZE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  readResponsiveProp,
  useWebsiteBuilderStore,
  writeResponsiveProp,
  type BlockStyle,
  type FieldSchema,
  type SelectOption,
  type SpacingValue,
} from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { defaultValueForField } from './field-defaults';
import { FieldGroup, type FieldGroupItem } from './FieldGroup';
import styles from './LayoutSection.module.scss';
import { SpacingBoxModel } from './SpacingBoxModel';

/** `SpacingValue` резолвленного поля (см. `basicItems` ниже) → число px для
 * визуальной схемы `SpacingBoxModel` — именованный пресет читает
 * `SPACING_PX`, число уже само по себе px. `undefined`/что угодно
 * неожиданное → `0`, схема не должна падать на промежуточном состоянии
 * поля. */
function toPx(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value in SPACING_PX) {
    return parseInt(SPACING_PX[value as keyof typeof SPACING_PX], 10);
  }
  return 0;
}

const BASIC_FIELDS: FieldSchema[] = [
  { key: 'background', label: 'Фон', control: 'select', options: BACKGROUND_OPTIONS },
  {
    key: 'paddingY',
    label: 'Отступы сверху/снизу',
    control: 'spacing',
    responsive: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'paddingX',
    label: 'Отступы слева/справа',
    control: 'spacing',
    responsive: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'marginTop',
    label: 'Отступ до блока',
    control: 'spacing',
    responsive: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'marginBottom',
    label: 'Отступ после блока',
    control: 'spacing',
    responsive: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'textAlign',
    label: 'Выравнивание текста',
    control: 'select',
    options: TEXT_ALIGN_OPTIONS,
  },
  {
    key: 'textColor',
    label: 'Цвет текста',
    control: 'color',
    hint: 'Пусто — берётся из темы сайта (с автопереключением на светлый на тёмном фоне).',
  },
  {
    key: 'maxWidth',
    label: 'Ширина контента',
    control: 'select',
    responsive: true,
    options: CONTAINER_WIDTH_OPTIONS,
  },
  {
    key: 'borderWidth',
    label: 'Рамка',
    control: 'select',
    options: BORDER_WIDTH_OPTIONS,
  },
  {
    key: 'shadow',
    label: 'Тень',
    control: 'select',
    options: BLOCK_SHADOW_OPTIONS,
  },
];

const CUSTOM_PADDING_FIELD: FieldSchema = {
  key: 'customPadding',
  label: 'Задать отступы по каждой стороне отдельно',
  control: 'toggle',
};

// Первым пунктом — не обычный `SpacingSize`, а «взять из пары сверху» (см.
// `BlockStyle.paddingTop`/`resolveSide` в `model/block-style.ts`): сторона
// без собственного значения не должна визуально означать «отступ отсутствует»
// — это уже отдельная, явная опция `SPACING_SIZE_OPTIONS[0]` («Нет»).
const INHERIT = '';
const PADDING_SIDE_OPTIONS: SelectOption[] = [
  { value: INHERIT, label: 'Как у пары выше' },
  ...SPACING_SIZE_OPTIONS,
];

const PADDING_SIDE_FIELDS: { key: keyof BlockStyle; label: string }[] = [
  { key: 'paddingTop', label: 'Сверху' },
  { key: 'paddingRight', label: 'Справа' },
  { key: 'paddingBottom', label: 'Снизу' },
  { key: 'paddingLeft', label: 'Слева' },
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
 * `BlockInspectorForm.tsx`).
 *
 * Два под-таба, а не один плоский список (ROADMAP.md §3.5/§8 Phase 11):
 * «Просто» — те же 7 полей, что были всегда, теперь дополнительно
 * responsive (значение читает/пишет активный вьюпорт канваса, тем же
 * `readResponsiveProp`/`writeResponsiveProp`, что и `BlockInspectorForm` для
 * `props`). «Дополнительно» — независимые отступы по каждой стороне,
 * скрытые по умолчанию: показывать все 4 стороны в обычном списке рядом с
 * уже привычной парой `paddingY`/`paddingX` добавило бы полю, которым
 * реально пользуются единицы, вес в панели, которой пользуются все.
 */
export function LayoutSection({ blockId, style, onChange, businessId }: LayoutSectionProps) {
  const viewport = useWebsiteBuilderStore((state) => state.viewport);
  const [tab, setTab] = useState<'basic' | 'advanced'>('basic');

  const basicItems: FieldGroupItem[] = BASIC_FIELDS.map((field) => {
    const rawValue = (style as Record<string, unknown> | undefined)?.[field.key];
    const fallback = defaultValueForField(field);
    const value = field.responsive ? readResponsiveProp(rawValue, viewport, fallback) : rawValue;

    return {
      field,
      value,
      onChange: (next: unknown) => {
        const nextValue = field.responsive
          ? writeResponsiveProp(rawValue, viewport, next, fallback)
          : next;
        onChange({ [field.key]: nextValue } as BlockStyle);
      },
    };
  });

  // Свой цвет фона — не отдельное поле в `BASIC_FIELDS` (в отличие от
  // остальных 7), а условная вставка сразу после «Фон»: показывать пустой
  // color picker всем, у кого background не 'custom', было бы шумом ради
  // поля, которым реально пользуются только выбравшие этот пресет.
  if (style?.background === 'custom') {
    const customColorField: FieldSchema = {
      key: 'customBackgroundColor',
      label: 'Свой цвет фона',
      control: 'color',
    };
    basicItems.splice(1, 0, {
      field: customColorField,
      value: style.customBackgroundColor,
      onChange: (next: unknown) => onChange({ customBackgroundColor: next as string }),
    });
  }

  // Градиент — та же условная вставка, что «Свой цвет» выше, только
  // несколько полей вместо одного (тип + два цвета + угол — угол только для
  // линейного, у радиального (круг) направления нет): показывать их всем, у
  // кого background не 'gradient', было бы тем же лишним шумом.
  if (style?.background === 'gradient') {
    const gradientTypeField: FieldSchema = {
      key: 'gradientType',
      label: 'Тип градиента',
      control: 'select',
      options: GRADIENT_TYPE_OPTIONS,
    };
    const gradientFromField: FieldSchema = {
      key: 'gradientFrom',
      label: 'Градиент — от',
      control: 'color',
    };
    const gradientToField: FieldSchema = {
      key: 'gradientTo',
      label: 'Градиент — до',
      control: 'color',
    };
    const gradientItems: FieldGroupItem[] = [
      {
        field: gradientTypeField,
        value: style.gradientType ?? 'linear',
        onChange: (next: unknown) => onChange({ gradientType: next as BlockStyle['gradientType'] }),
      },
      {
        field: gradientFromField,
        value: style.gradientFrom,
        onChange: (next: unknown) => onChange({ gradientFrom: next as string }),
      },
      {
        field: gradientToField,
        value: style.gradientTo,
        onChange: (next: unknown) => onChange({ gradientTo: next as string }),
      },
    ];
    if ((style.gradientType ?? 'linear') === 'linear') {
      const gradientAngleField: FieldSchema = {
        key: 'gradientAngle',
        label: 'Угол градиента',
        control: 'number',
        min: 0,
        max: 360,
        suffix: '°',
      };
      gradientItems.push({
        field: gradientAngleField,
        value: style.gradientAngle ?? 135,
        onChange: (next: unknown) => onChange({ gradientAngle: next as number }),
      });
    }
    basicItems.splice(1, 0, ...gradientItems);
  }

  // Цвет рамки — условная вставка сразу после «Рамка», тот же приём, что и
  // выше: показывать её, пока рамка выключена ('none'), было бы лишним
  // шумом. Ищем позицию `borderWidth` по ключу, а не по фиксированному
  // индексу — он сдвигается на количество уже вставленных выше полей
  // фона/градиента.
  if (style?.borderWidth && style.borderWidth !== 'none') {
    const borderColorField: FieldSchema = {
      key: 'borderColor',
      label: 'Цвет рамки',
      control: 'color',
      hint: 'Пусто — берётся из темы сайта.',
    };
    const borderWidthIndex = basicItems.findIndex((item) => item.field.key === 'borderWidth');
    basicItems.splice(borderWidthIndex + 1, 0, {
      field: borderColorField,
      value: style.borderColor,
      onChange: (next: unknown) => onChange({ borderColor: next as string }),
    });
  }

  const customPadding = Boolean(style?.customPadding);
  const sideItems: FieldGroupItem[] = PADDING_SIDE_FIELDS.map(({ key, label }) => {
    const field: FieldSchema = {
      key,
      label,
      control: 'spacing',
      responsive: true,
      options: PADDING_SIDE_OPTIONS,
    };
    const rawValue = (style as Record<string, unknown> | undefined)?.[key];
    const resolved = readResponsiveProp<SpacingValue | null>(rawValue, viewport, null);

    return {
      field,
      value: resolved ?? INHERIT,
      onChange: (next: unknown) => {
        const nextValue: SpacingValue | null = next === INHERIT ? null : (next as SpacingValue);
        const written = writeResponsiveProp<SpacingValue | null>(
          rawValue,
          viewport,
          nextValue,
          null,
        );
        onChange({ [key]: written } as BlockStyle);
      },
    };
  });

  return (
    <div className={styles.section}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={cn(styles.tab, tab === 'basic' && styles['tab--active'])}
          onClick={() => setTab('basic')}
        >
          Просто
        </button>
        <button
          type="button"
          className={cn(styles.tab, tab === 'advanced' && styles['tab--active'])}
          onClick={() => setTab('advanced')}
        >
          Дополнительно
        </button>
      </div>

      {tab === 'basic' && (
        <>
          <SpacingBoxModel
            paddingTop={toPx(basicItems.find((item) => item.field.key === 'paddingY')?.value)}
            paddingBottom={toPx(basicItems.find((item) => item.field.key === 'paddingY')?.value)}
            paddingLeft={toPx(basicItems.find((item) => item.field.key === 'paddingX')?.value)}
            paddingRight={toPx(basicItems.find((item) => item.field.key === 'paddingX')?.value)}
            marginTop={toPx(basicItems.find((item) => item.field.key === 'marginTop')?.value)}
            marginBottom={toPx(basicItems.find((item) => item.field.key === 'marginBottom')?.value)}
          />
          <FieldGroup resetKey={blockId} businessId={businessId} items={basicItems} />
        </>
      )}

      {tab === 'advanced' && (
        <div className={styles.advanced}>
          <FieldGroup
            resetKey={blockId}
            businessId={businessId}
            items={[
              {
                field: CUSTOM_PADDING_FIELD,
                value: customPadding,
                onChange: (next) => onChange({ customPadding: Boolean(next) }),
              },
            ]}
          />

          {customPadding ? (
            <FieldGroup resetKey={blockId} businessId={businessId} items={sideItems} />
          ) : (
            <p className={styles.advanced__hint}>
              Пока выключено — стороны наследуют пару «Отступы сверху/снизу»/«Отступы слева/справа»
              из вкладки «Просто».
            </p>
          )}
        </div>
      )}
    </div>
  );
}
