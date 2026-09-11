'use client';

import { useState } from 'react';
import {
  BACKGROUND_OPTIONS,
  BLOCK_SHADOW_OPTIONS,
  BORDER_WIDTH_OPTIONS,
  CONTAINER_WIDTH_OPTIONS,
  ENTRANCE_ANIMATION_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  GRID_COLUMNS_OPTIONS,
  LAYOUT_ALIGN_OPTIONS,
  LAYOUT_DIRECTION_OPTIONS,
  LAYOUT_DISPLAY_OPTIONS,
  LAYOUT_GROW_OPTIONS,
  LAYOUT_JUSTIFY_OPTIONS,
  SPACING_PX,
  SPACING_SIZE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  readResponsiveProp,
  useWebsiteBuilderStore,
  writeResponsiveProp,
  type AdvancedCssProperty,
  type BlockStyle,
  type FieldSchema,
  type LayoutDisplay,
  type SelectOption,
  type SpacingValue,
} from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ColumnsIcon,
  GridIcon,
  MoreIcon,
  PaletteIcon,
  RowsIcon,
} from '@/shared/ui/icons';
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

/** `TEXT_ALIGN_OPTIONS` (`theme-tokens.ts`) с иконками для сегментированного
 * контрола (`control: 'segmented'`) — иконки нужны только здесь (визуальный
 * пикер конкретно в инспекторе билдера), поэтому не в самом
 * `theme-tokens.ts` (он не должен знать про React-компоненты иконок). */
const TEXT_ALIGN_SEGMENTED_OPTIONS = TEXT_ALIGN_OPTIONS.map((option) => ({
  ...option,
  icon:
    option.value === 'left'
      ? AlignLeftIcon
      : option.value === 'center'
        ? AlignCenterIcon
        : AlignRightIcon,
}));

/** Тот же приём, что у `TEXT_ALIGN_SEGMENTED_OPTIONS` выше — иконки вместо
 * текста для «Как располагать детей» (AI_PLATFORM_ROADMAP.md §45.1/§47:
 * выбор «стопкой/рядом/сеткой» — по сути выбор МОДЕЛИ раскладки, самый
 * заметный CSS-жаргон во всём инспекторе, иконка со схемой формы читается
 * быстрее короткого текста в узкой колонке). Переиспользует те же иконки,
 * что уже стоят на кнопках блоков `section`/`columns`/`container` в
 * библиотеке (`blocks/layout/index.tsx`) — концептуально то же самое: ряд
 * горизонтальных линий = стопка, колонки рядом = flex, сетка = grid. */
const LAYOUT_DISPLAY_SEGMENTED_OPTIONS = LAYOUT_DISPLAY_OPTIONS.map((option) => ({
  ...option,
  icon: option.value === 'block' ? RowsIcon : option.value === 'flex' ? ColumnsIcon : GridIcon,
}));

/** Та же идея — «горизонтально»/«вертикально» иконкой, не словом. */
const LAYOUT_DIRECTION_SEGMENTED_OPTIONS = LAYOUT_DIRECTION_OPTIONS.map((option) => ({
  ...option,
  icon: option.value === 'row' ? ColumnsIcon : RowsIcon,
}));

const BASIC_FIELDS: FieldSchema[] = [
  { key: 'background', label: 'Фон', control: 'select', options: BACKGROUND_OPTIONS },
  {
    key: 'paddingY',
    label: 'Отступы сверху/снизу',
    control: 'scale',
    responsive: true,
    allowCustomPx: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'paddingX',
    label: 'Отступы слева/справа',
    control: 'scale',
    responsive: true,
    allowCustomPx: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'marginTop',
    label: 'Отступ до блока',
    control: 'scale',
    responsive: true,
    allowCustomPx: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'marginBottom',
    label: 'Отступ после блока',
    control: 'scale',
    responsive: true,
    allowCustomPx: true,
    options: SPACING_SIZE_OPTIONS,
  },
  {
    key: 'textAlign',
    label: 'Выравнивание текста',
    control: 'segmented',
    options: TEXT_ALIGN_SEGMENTED_OPTIONS,
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
    control: 'scale',
    options: BORDER_WIDTH_OPTIONS,
  },
  {
    key: 'shadow',
    label: 'Тень',
    control: 'scale',
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

// --- Раскладка (только контейнерные блоки — `section`/`container`/
// `columns`, вкладка «Раскладка» показывается только когда `isContainer`) --

const LAYOUT_DISPLAY_FIELD: FieldSchema = {
  key: 'display',
  label: 'Как располагать детей',
  control: 'segmented',
  responsive: true,
  options: LAYOUT_DISPLAY_SEGMENTED_OPTIONS,
};
const LAYOUT_DIRECTION_FIELD: FieldSchema = {
  key: 'direction',
  label: 'Направление',
  control: 'segmented',
  responsive: true,
  options: LAYOUT_DIRECTION_SEGMENTED_OPTIONS,
};
const LAYOUT_WRAP_FIELD: FieldSchema = {
  key: 'wrap',
  label: 'Переносить на новую строку',
  control: 'toggle',
};
const LAYOUT_JUSTIFY_FIELD: FieldSchema = {
  key: 'justify',
  label: 'Выравнивание по строке',
  control: 'select',
  options: LAYOUT_JUSTIFY_OPTIONS,
};
const LAYOUT_ALIGN_FIELD: FieldSchema = {
  key: 'align',
  label: 'Выравнивание поперёк',
  control: 'select',
  options: LAYOUT_ALIGN_OPTIONS,
};
const LAYOUT_GAP_FIELD: FieldSchema = {
  key: 'gap',
  label: 'Промежуток между детьми',
  control: 'scale',
  responsive: true,
  allowCustomPx: true,
  options: SPACING_SIZE_OPTIONS,
};
const LAYOUT_GRID_COLUMNS_FIELD: FieldSchema = {
  key: 'gridColumns',
  label: 'Число колонок',
  control: 'scale',
  responsive: true,
  options: GRID_COLUMNS_OPTIONS,
};

// --- Позиция в ряду (любой блок — актуально, только когда его родитель сам
// flex/grid, но безопасно как no-op на любом другом родителе) -------------

const POSITION_GROW_FIELD: FieldSchema = {
  key: 'grow',
  label: 'Ширина в ряду',
  control: 'select',
  options: LAYOUT_GROW_OPTIONS,
};
const POSITION_FIXED_WIDTH_FIELD: FieldSchema = {
  key: 'fixedWidth',
  label: 'Ширина',
  control: 'number',
  min: 40,
  max: 800,
  suffix: 'px',
};
const POSITION_STICKY_FIELD: FieldSchema = {
  key: 'sticky',
  label: 'Прилипает при прокрутке',
  control: 'toggle',
};
const POSITION_STICKY_OFFSET_FIELD: FieldSchema = {
  key: 'stickyOffset',
  label: 'Отступ от верха',
  control: 'number',
  min: 0,
  max: 400,
  suffix: 'px',
};
const POSITION_GRID_COLUMN_SPAN_FIELD: FieldSchema = {
  key: 'gridColumnSpan',
  label: 'Ширина в колонках (сетка родителя)',
  control: 'number',
  responsive: true,
  min: 1,
  max: 6,
  hint: 'Работает, только если родитель — «Сеткой» (bento/асимметричная раскладка).',
};
const POSITION_GRID_ROW_SPAN_FIELD: FieldSchema = {
  key: 'gridRowSpan',
  label: 'Высота в строках (сетка родителя)',
  control: 'number',
  responsive: true,
  min: 1,
  max: 6,
  hint: 'Работает, только если родитель — «Сеткой».',
};
const ENTRANCE_ANIMATION_FIELD: FieldSchema = {
  key: 'entranceAnimation',
  label: 'Появление при прокрутке',
  control: 'select',
  options: ENTRANCE_ANIMATION_OPTIONS,
};
const ENTRANCE_DELAY_FIELD: FieldSchema = {
  key: 'entranceDelay',
  label: 'Задержка появления',
  control: 'number',
  min: 0,
  max: 800,
  step: 50,
  suffix: 'мс',
};

/** "Продвинутый CSS" (AI_PLATFORM_ROADMAP.md §78) — ограниченная "форточка"
 * для дизайнов, которые не укладываются в закрытые поля выше (наклон/
 * поворот, произвольная форма, размытие/glass-эффект, свободная тень/
 * скругление). Значения — просто строки, backend (`buildValidatedStyle`,
 * `advanced`-ветка) перепроверяет каждую независимо от того, что показано
 * здесь — это не единственный рубеж защиты, см. `BlockStyle.advanced`'s
 * комментарий в `types.ts`. */
const ADVANCED_CSS_FIELD_DEFS: Array<{
  key: AdvancedCssProperty;
  field: FieldSchema;
}> = [
  {
    key: 'transform',
    field: {
      key: 'transform',
      label: 'Трансформация (поворот/наклон/масштаб)',
      control: 'text',
      placeholder: 'rotate(-4deg)',
      hint: 'Например: rotate(-4deg), skewX(6deg), scale(1.05)',
    },
  },
  {
    key: 'clipPath',
    field: {
      key: 'clipPath',
      label: 'Обрезка формы (clip-path)',
      control: 'text',
      placeholder: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)',
      hint: 'Например: polygon(...), circle(60%), inset(10% 0)',
    },
  },
  {
    key: 'filter',
    field: {
      key: 'filter',
      label: 'Фильтр (размытие/яркость и т. п.)',
      control: 'text',
      placeholder: 'blur(6px) saturate(1.3)',
    },
  },
  {
    key: 'backdropFilter',
    field: {
      key: 'backdropFilter',
      label: 'Фильтр фона за блоком (стекло)',
      control: 'text',
      placeholder: 'blur(12px)',
    },
  },
  {
    key: 'mixBlendMode',
    field: {
      key: 'mixBlendMode',
      label: 'Смешивание с фоном',
      control: 'select',
      options: [
        { value: 'normal', label: 'Обычное' },
        { value: 'multiply', label: 'Умножение' },
        { value: 'screen', label: 'Экран' },
        { value: 'overlay', label: 'Наложение' },
        { value: 'darken', label: 'Затемнение' },
        { value: 'lighten', label: 'Осветление' },
        { value: 'color-dodge', label: 'Color dodge' },
        { value: 'color-burn', label: 'Color burn' },
        { value: 'hard-light', label: 'Hard light' },
        { value: 'soft-light', label: 'Soft light' },
        { value: 'difference', label: 'Разница' },
        { value: 'exclusion', label: 'Исключение' },
        { value: 'hue', label: 'Оттенок' },
        { value: 'saturation', label: 'Насыщенность' },
        { value: 'color', label: 'Цвет' },
        { value: 'luminosity', label: 'Светлота' },
      ],
    },
  },
  {
    key: 'opacity',
    field: {
      key: 'opacity',
      label: 'Прозрачность (0–1)',
      control: 'text',
      placeholder: '0.8',
    },
  },
  {
    key: 'borderRadius',
    field: {
      key: 'borderRadius',
      label: 'Скругление (свободное)',
      control: 'text',
      placeholder: '40% 60% 60% 40%',
      hint: 'Для органичных/«блоб»-форм — иначе используйте обычную рамку выше.',
    },
  },
  {
    key: 'boxShadow',
    field: {
      key: 'boxShadow',
      label: 'Тень (свободная)',
      control: 'text',
      placeholder: '0 20px 60px rgba(0,0,0,.35)',
    },
  },
  {
    key: 'letterSpacing',
    field: {
      key: 'letterSpacing',
      label: 'Межбуквенный интервал',
      control: 'text',
      placeholder: '0.05em',
    },
  },
  {
    key: 'textTransform',
    field: {
      key: 'textTransform',
      label: 'Регистр текста',
      control: 'select',
      options: [
        { value: 'none', label: 'Обычный' },
        { value: 'uppercase', label: 'ВСЕ ЗАГЛАВНЫЕ' },
        { value: 'lowercase', label: 'все строчные' },
        { value: 'capitalize', label: 'Каждое Слово С Заглавной' },
      ],
    },
  },
  {
    key: 'fontStyle',
    field: {
      key: 'fontStyle',
      label: 'Начертание',
      control: 'select',
      options: [
        { value: 'normal', label: 'Обычное' },
        { value: 'italic', label: 'Курсив' },
        { value: 'oblique', label: 'Наклонное' },
      ],
    },
  },
  {
    key: 'fontWeight',
    field: {
      key: 'fontWeight',
      label: 'Насыщенность шрифта',
      control: 'text',
      placeholder: '700',
      hint: '100–900 (шагом 100) или normal/bold',
    },
  },
];

/** Enum-поля (`mixBlendMode`/`textTransform`/`fontStyle`) рендерятся через
 * `control: 'select'` — сам `<select>` структурно не может выдать
 * недопустимое значение, проверка нужна только "свободным" текстовым полям. */
const ADVANCED_ENUM_KEYS: ReadonlySet<AdvancedCssProperty> = new Set([
  'mixBlendMode',
  'textTransform',
  'fontStyle',
]);

const ADVANCED_FORBIDDEN_PATTERN = /url\(|expression\(|javascript:|@import|[;<>{}\\]/i;
const ADVANCED_SAFE_CHARS_RE = /^[a-zA-Z0-9\s.,%+\-#()'/]*$/;
const MAX_ADVANCED_VALUE_LENGTH = 200;

/** Клиентское зеркало backend's `sanitizeAdvancedCssValue` (`block-style-
 * schema.ts`) — та же проверка, ради мгновенной обратной связи в инспекторе,
 * не единственный рубеж: backend перепроверяет заново независимо от того,
 * что прошло здесь (см. `BlockStyle.advanced`'s комментарий в `types.ts`). */
function validateAdvancedCssValue(key: AdvancedCssProperty, value: string): string | null {
  if (value.length === 0) return null;
  if (value.length > MAX_ADVANCED_VALUE_LENGTH) {
    return `Слишком длинное значение (максимум ${MAX_ADVANCED_VALUE_LENGTH} символов)`;
  }
  if (ADVANCED_FORBIDDEN_PATTERN.test(value)) {
    return 'Недопустимая конструкция (url()/expression()/@import/спецсимволы) — только само значение CSS-свойства';
  }
  if (!ADVANCED_ENUM_KEYS.has(key) && !ADVANCED_SAFE_CHARS_RE.test(value)) {
    return "Недопустимые символы — разрешены буквы/цифры/пробелы/. , % + - # ( ) ' /";
  }
  return null;
}

export interface LayoutSectionProps {
  style: BlockStyle | undefined;
  onChange: (patch: BlockStyle) => void;
  businessId: string;
  /** Только контейнерные блоки (`definition.isContainer`, см.
   * `BlockInspectorForm.tsx`) реально раскладывают своих детей — у
   * остальных вкладка «Раскладка» просто не показывается, чтобы не путать
   * настройкой, которая ни на что не влияет. */
  isContainer?: boolean;
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
export function LayoutSection({ style, onChange, businessId, isContainer }: LayoutSectionProps) {
  const viewport = useWebsiteBuilderStore((state) => state.viewport);
  const [tab, setTab] = useState<'basic' | 'layout' | 'advanced'>('basic');
  // "Продвинутый CSS" — черновик набранного текста + ошибка на поле, ПОКА
  // значение не прошло проверку (см. `validateAdvancedCssValue` ниже): та же
  // проверка, что и на backend (`buildValidatedStyle`'s `advanced`-ветка),
  // здесь клиентская копия ради мгновенной обратной связи — невалидное
  // значение НИКОГДА не уходит в `onChange`/canvas, только в это локальное
  // состояние, иначе поле "откатывалось" бы на каждую невалидную клавишу.
  const [advancedDrafts, setAdvancedDrafts] = useState<
    Partial<Record<AdvancedCssProperty, string>>
  >({});
  const [advancedErrors, setAdvancedErrors] = useState<
    Partial<Record<AdvancedCssProperty, string>>
  >({});

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
      control: 'scale',
      responsive: true,
      allowCustomPx: true,
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

  // Раскладка детей (только контейнерные блоки) — как `basicItems`, но со
  // своей условной вставкой: `direction`/`wrap` осмысленны только при
  // `display:'flex'`, `gridColumns` — только при `'grid'`, `justify`/`align`
  // не нужны вовсе при `'block'` (обычный вертикальный стек, менять нечего).
  const displayValue = readResponsiveProp<LayoutDisplay>(style?.display, viewport, 'block');
  const layoutItems: FieldGroupItem[] = [
    {
      field: LAYOUT_DISPLAY_FIELD,
      value: displayValue,
      onChange: (next: unknown) =>
        onChange({
          display: writeResponsiveProp(
            style?.display,
            viewport,
            next,
            'block',
          ) as BlockStyle['display'],
        }),
    },
  ];
  if (displayValue !== 'block') {
    layoutItems.push({
      field: LAYOUT_GAP_FIELD,
      value: readResponsiveProp(style?.gap, viewport, 'md'),
      onChange: (next: unknown) =>
        onChange({
          gap: writeResponsiveProp(style?.gap, viewport, next, 'md') as BlockStyle['gap'],
        }),
    });
  }
  if (displayValue === 'flex') {
    layoutItems.push(
      {
        field: LAYOUT_DIRECTION_FIELD,
        value: readResponsiveProp(style?.direction, viewport, 'row'),
        onChange: (next: unknown) =>
          onChange({
            direction: writeResponsiveProp(
              style?.direction,
              viewport,
              next,
              'row',
            ) as BlockStyle['direction'],
          }),
      },
      {
        field: LAYOUT_WRAP_FIELD,
        value: Boolean(style?.wrap),
        onChange: (next: unknown) => onChange({ wrap: Boolean(next) }),
      },
    );
  }
  if (displayValue === 'grid') {
    layoutItems.push({
      field: LAYOUT_GRID_COLUMNS_FIELD,
      value: String(readResponsiveProp(style?.gridColumns, viewport, 3)),
      onChange: (next: unknown) =>
        onChange({
          gridColumns: writeResponsiveProp(
            style?.gridColumns,
            viewport,
            Number(next),
            3,
          ) as BlockStyle['gridColumns'],
        }),
    });
  }
  if (displayValue !== 'block') {
    layoutItems.push(
      {
        field: LAYOUT_JUSTIFY_FIELD,
        value: style?.justify ?? 'start',
        onChange: (next: unknown) => onChange({ justify: next as BlockStyle['justify'] }),
      },
      {
        field: LAYOUT_ALIGN_FIELD,
        value: style?.align ?? 'stretch',
        onChange: (next: unknown) => onChange({ align: next as BlockStyle['align'] }),
      },
    );
  }

  // Позиция блока как ребёнка чужого ряда/сетки — на ЛЮБОМ блоке, не только
  // контейнерах (одиночная картинка/кнопка тоже может быть частью чужого
  // flex-ряда). `fixedWidth`/`stickyOffset` — условная вставка сразу после
  // своего тумблера, тот же приём, что `customBackgroundColor` в `basicItems`.
  const growValue = style?.grow ?? 'grow';
  const positionItems: FieldGroupItem[] = [
    {
      field: POSITION_GROW_FIELD,
      value: growValue,
      onChange: (next: unknown) => onChange({ grow: next as BlockStyle['grow'] }),
    },
  ];
  if (growValue === 'fixed') {
    positionItems.push({
      field: POSITION_FIXED_WIDTH_FIELD,
      value: style?.fixedWidth ?? 240,
      onChange: (next: unknown) => onChange({ fixedWidth: next as number }),
    });
  }
  positionItems.push(
    {
      field: POSITION_GRID_COLUMN_SPAN_FIELD,
      value: readResponsiveProp(style?.gridColumnSpan, viewport, 1),
      onChange: (next: unknown) =>
        onChange({
          gridColumnSpan: writeResponsiveProp(
            style?.gridColumnSpan,
            viewport,
            Number(next),
            1,
          ) as BlockStyle['gridColumnSpan'],
        }),
    },
    {
      field: POSITION_GRID_ROW_SPAN_FIELD,
      value: readResponsiveProp(style?.gridRowSpan, viewport, 1),
      onChange: (next: unknown) =>
        onChange({
          gridRowSpan: writeResponsiveProp(
            style?.gridRowSpan,
            viewport,
            Number(next),
            1,
          ) as BlockStyle['gridRowSpan'],
        }),
    },
  );
  positionItems.push({
    field: POSITION_STICKY_FIELD,
    value: Boolean(style?.sticky),
    onChange: (next: unknown) => onChange({ sticky: Boolean(next) }),
  });
  if (style?.sticky) {
    positionItems.push({
      field: POSITION_STICKY_OFFSET_FIELD,
      value: style?.stickyOffset ?? 0,
      onChange: (next: unknown) => onChange({ stickyOffset: next as number }),
    });
  }
  const entranceAnimationValue = style?.entranceAnimation ?? 'none';
  positionItems.push({
    field: ENTRANCE_ANIMATION_FIELD,
    value: entranceAnimationValue,
    onChange: (next: unknown) =>
      onChange({ entranceAnimation: next as BlockStyle['entranceAnimation'] }),
  });
  if (entranceAnimationValue !== 'none') {
    positionItems.push({
      field: ENTRANCE_DELAY_FIELD,
      value: style?.entranceDelay ?? 0,
      onChange: (next: unknown) => onChange({ entranceDelay: next as number }),
    });
  }

  // "Продвинутый CSS" (AI_PLATFORM_ROADMAP.md §78) — `advanced` мёржится на
  // уровне `WebsiteBuilderStore.updateBlockStyle` ШИРОКО (`{ ...block.style,
  // ...patch }`), не рекурсивно — значит патч с одним изменённым ключом
  // `advanced` заменил бы ВЕСЬ существующий объект `advanced`, стерев другие
  // уже заданные свойства. Каждый onChange здесь поэтому сам расширяет
  // текущий `style?.advanced`, прежде чем передать `onChange`. Невалидное
  // значение остаётся только в `advancedDrafts`/`advancedErrors` (см. их
  // комментарий выше) — никогда не доходит до `onChange`/canvas.
  const advancedCssItems: FieldGroupItem[] = ADVANCED_CSS_FIELD_DEFS.map(({ key, field }) => {
    const committedValue = style?.advanced?.[key] ?? '';
    const displayValue = key in advancedDrafts ? (advancedDrafts[key] ?? '') : committedValue;

    return {
      field,
      value: displayValue,
      onChange: (next: unknown) => {
        const raw = typeof next === 'string' ? next : '';
        const error = ADVANCED_ENUM_KEYS.has(key) ? null : validateAdvancedCssValue(key, raw);
        setAdvancedDrafts((prev) => ({ ...prev, [key]: raw }));
        setAdvancedErrors((prev) => ({ ...prev, [key]: error ?? undefined }));
        if (error) return;

        const nextAdvanced = { ...style?.advanced };
        if (raw.trim().length > 0) {
          nextAdvanced[key] = raw;
        } else {
          delete nextAdvanced[key as keyof typeof nextAdvanced];
        }
        onChange({ advanced: nextAdvanced as BlockStyle['advanced'] });
      },
    };
  });
  const advancedCssErrorMessages = ADVANCED_CSS_FIELD_DEFS.map(({ key, field }) =>
    advancedErrors[key] ? `${field.label}: ${advancedErrors[key]}` : null,
  ).filter((message): message is string => Boolean(message));

  return (
    <div className={styles.section}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={cn(styles.tab, tab === 'basic' && styles['tab--active'])}
          onClick={() => setTab('basic')}
        >
          <PaletteIcon className={styles.tab__icon} />
          Просто
        </button>
        {isContainer && (
          <button
            type="button"
            className={cn(styles.tab, tab === 'layout' && styles['tab--active'])}
            onClick={() => setTab('layout')}
          >
            <GridIcon className={styles.tab__icon} />
            Раскладка
          </button>
        )}
        <button
          type="button"
          className={cn(styles.tab, tab === 'advanced' && styles['tab--active'])}
          onClick={() => setTab('advanced')}
        >
          <MoreIcon className={styles.tab__icon} />
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
          <FieldGroup businessId={businessId} items={basicItems} />
        </>
      )}

      {tab === 'layout' && isContainer && (
        <FieldGroup businessId={businessId} items={layoutItems} />
      )}

      {tab === 'advanced' && (
        <div className={styles.advanced}>
          <FieldGroup
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
            <FieldGroup businessId={businessId} items={sideItems} />
          ) : (
            <p className={styles.advanced__hint}>
              Пока выключено — стороны наследуют пару «Отступы сверху/снизу»/«Отступы слева/справа»
              из вкладки «Просто».
            </p>
          )}

          <p className={styles.advanced__hint}>
            Позиция в чужом ряду/сетке — работает, только если РОДИТЕЛЬ этого блока сам «Рядом
            (flex)» или «Сеткой» (вкладка «Раскладка» родителя).
          </p>
          <FieldGroup businessId={businessId} items={positionItems} />

          <p className={styles.advanced__hint}>
            Продвинутый CSS — для дизайна, который не укладывается в поля выше (наклон, необычная
            форма, размытие, свободная тень/скругление). Используйте редко, только когда обычных
            полей действительно не хватает.
          </p>
          <FieldGroup businessId={businessId} items={advancedCssItems} />
          {advancedCssErrorMessages.map((message) => (
            <p key={message} className={styles.advanced__error} role="alert">
              {message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
