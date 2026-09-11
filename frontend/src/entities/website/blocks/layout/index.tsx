import { cn } from '@/shared/lib/cn';
import {
  ColumnsIcon,
  GridIcon,
  MinusIcon,
  PreviewColumnsIcon,
  PreviewContainerIcon,
  PreviewDividerIcon,
  PreviewFullWidthIcon,
  PreviewSpacerIcon,
  RowsIcon,
  WaveIcon,
} from '@/shared/ui/icons';
import { SPACING_PX } from '../../model/theme-tokens';
import type { BlockRendererProps, FieldSchema } from '../../model/registry';
import { registerBlock } from '../../model/registry';
import type { SpacingSize } from '../../model/types';
import { ICON_CHOICE_OPTIONS, resolveIconChoice } from '../shared/icon-choices';
import styles from './layout.module.scss';

// --- Section ---------------------------------------------------------------
// Пустая структурная оболочка — вся видимая настройка (фон/отступы/ширина)
// приходит из универсального `BlockStyle` (см. `BlockRenderer.tsx`), этому
// блоку не нужны собственные `props`/`fields` вообще. Основной строительный
// блок страницы — то, из чего в первую очередь состоит любой сайт.

interface EmptyProps {
  [key: string]: never;
}

function SectionRenderer({ children, layout }: BlockRendererProps<EmptyProps>) {
  return (
    <div className={styles.section} style={layout}>
      {children}
    </div>
  );
}

registerBlock<EmptyProps>({
  type: 'section',
  label: 'Секция',
  category: 'layout',
  icon: RowsIcon,
  previewIcon: PreviewFullWidthIcon,
  description: 'Полноширинная полоса — основной строительный блок страницы',
  defaultProps: {},
  fields: [],
  isContainer: true,
  Renderer: SectionRenderer,
});

// --- Container ---------------------------------------------------------------
// Тот же структурный блок, что Section, но по умолчанию у́же и без фона —
// удобен, чтобы внутри уже широкой секции завести отдельную более узкую
// колонку контента (текстовый блок, форма), а не только на верхнем уровне.

function ContainerRenderer({ children, layout }: BlockRendererProps<EmptyProps>) {
  return (
    <div className={styles.container} style={layout}>
      {children}
    </div>
  );
}

registerBlock<EmptyProps>({
  type: 'container',
  label: 'Контейнер',
  category: 'layout',
  icon: GridIcon,
  previewIcon: PreviewContainerIcon,
  description: 'Более узкая колонка контента внутри секции',
  defaultProps: {},
  defaultStyle: { maxWidth: 'narrow' },
  fields: [],
  isContainer: true,
  Renderer: ContainerRenderer,
});

// --- Column (внутренний, не в библиотеке) -----------------------------------

function ColumnRenderer({ children, layout }: BlockRendererProps<EmptyProps>) {
  return (
    <div className={styles.column} style={layout}>
      {children}
    </div>
  );
}

registerBlock<EmptyProps>({
  type: 'column',
  label: 'Колонка',
  category: 'layout',
  icon: ColumnsIcon,
  description: 'Одна колонка внутри блока «Колонки»',
  defaultProps: {},
  fields: [],
  isContainer: true,
  hidden: true,
  Renderer: ColumnRenderer,
});

// --- Columns -----------------------------------------------------------------
// Число реальных колонок = число дочерних `column`-блоков, а не отдельное
// число в `props` — сетка сама подстраивается под фактических детей
// (`auto-fit`), поэтому добавление/удаление колонки (см. `Canvas.tsx`,
// кнопка «+ Добавить колонку» у выбранного блока `columns`) не должно
// держать в синхроне никакой отдельный счётчик.

function ColumnsRenderer({ children, layout }: BlockRendererProps<EmptyProps>) {
  return (
    <div className={styles.columns} style={layout}>
      {children}
    </div>
  );
}

registerBlock<EmptyProps>({
  type: 'columns',
  label: 'Колонки',
  category: 'layout',
  icon: ColumnsIcon,
  previewIcon: PreviewColumnsIcon,
  description: 'Разбивает контент на несколько колонок рядом',
  defaultProps: {},
  fields: [],
  isContainer: true,
  // Число колонок = число дочерних `column` (см. комментарий выше про
  // `ColumnsRenderer`) — обычный блок, вставленный сюда напрямую минуя
  // `column`, сломал бы это предположение, поэтому единственный
  // допустимый тип ребёнка здесь — `column`.
  allowedChildren: ['column'],
  Renderer: ColumnsRenderer,
});

// --- Spacer --------------------------------------------------------------

interface SpacerProps {
  height: SpacingSize;
}

function SpacerRenderer({ props }: BlockRendererProps<SpacerProps>) {
  return <div style={{ height: SPACING_PX[props.height] }} aria-hidden="true" />;
}

const spacerFields: FieldSchema[] = [
  {
    key: 'height',
    label: 'Высота',
    control: 'select',
    options: [
      { value: 'sm', label: 'Маленькая' },
      { value: 'md', label: 'Средняя' },
      { value: 'lg', label: 'Большая' },
      { value: 'xl', label: 'Очень большая' },
    ],
  },
];

registerBlock<SpacerProps>({
  type: 'spacer',
  label: 'Отступ',
  category: 'layout',
  icon: MinusIcon,
  previewIcon: PreviewSpacerIcon,
  description: 'Пустое вертикальное пространство между блоками',
  defaultProps: { height: 'md' },
  fields: spacerFields,
  Renderer: SpacerRenderer,
});

// --- Divider ---------------------------------------------------------------

interface DividerProps {
  style: 'solid' | 'dashed';
}

function DividerRenderer({ props }: BlockRendererProps<DividerProps>) {
  return <hr className={styles.divider} data-style={props.style} />;
}

const dividerFields: FieldSchema[] = [
  {
    key: 'style',
    label: 'Стиль линии',
    control: 'select',
    options: [
      { value: 'solid', label: 'Сплошная' },
      { value: 'dashed', label: 'Пунктирная' },
    ],
  },
];

registerBlock<DividerProps>({
  type: 'divider',
  label: 'Разделитель',
  category: 'layout',
  icon: MinusIcon,
  previewIcon: PreviewDividerIcon,
  description: 'Тонкая горизонтальная линия',
  defaultProps: { style: 'solid' },
  fields: dividerFields,
  Renderer: DividerRenderer,
});

// --- Divider with label / icon ------------------------------------------
// Отдельные типы, не поля у `divider` выше — у того одна прямая линия и
// одно простое поле `style`, здесь принципиально другая структура (линия —
// текст/иконка — линия), плюс `divider` уже используется на существующих
// сайтах с текущей формой `props`, менять её задним числом рискованно.

interface DividerLabelProps {
  text: string;
}

function DividerLabelRenderer({ props }: BlockRendererProps<DividerLabelProps>) {
  return (
    <div className={styles['divider-label']}>
      <span className={styles['divider-label__line']} />
      <span className={styles['divider-label__text']}>{props.text}</span>
      <span className={styles['divider-label__line']} />
    </div>
  );
}

registerBlock<DividerLabelProps>({
  type: 'dividerlabel',
  label: 'Разделитель с текстом',
  category: 'layout',
  icon: MinusIcon,
  previewIcon: PreviewDividerIcon,
  description: 'Горизонтальная линия с текстом по центру — например, «или»',
  defaultProps: { text: 'или' },
  fields: [{ key: 'text', label: 'Текст', control: 'text' }],
  Renderer: DividerLabelRenderer,
});

interface DividerIconProps {
  icon: string;
}

function DividerIconRenderer({ props }: BlockRendererProps<DividerIconProps>) {
  const Icon = resolveIconChoice(props.icon);
  return (
    <div className={styles['divider-label']}>
      <span className={styles['divider-label__line']} />
      <span className={styles['divider-label__icon']}>
        {/* eslint-disable-next-line react-hooks/static-components -- то же осознанное отклонение, что и в blocks/actions/index.tsx: иконка выбирается по данным, не статический компонент */}
        <Icon />
      </span>
      <span className={styles['divider-label__line']} />
    </div>
  );
}

registerBlock<DividerIconProps>({
  type: 'dividericon',
  label: 'Разделитель с иконкой',
  category: 'layout',
  icon: MinusIcon,
  previewIcon: PreviewDividerIcon,
  description: 'Горизонтальная линия с иконкой-значком по центру',
  defaultProps: { icon: 'star' },
  fields: [{ key: 'icon', label: 'Иконка', control: 'select', options: ICON_CHOICE_OPTIONS }],
  Renderer: DividerIconRenderer,
});

// --- Shape divider -----------------------------------------------------
// Фигурный разделитель между секциями (волна/капля/треугольник) — приём из
// Wix/Squarespace/Elementor, которого в проекте раньше не было вообще (три
// существующих `divider*` выше — прямая линия, максимум с текстом/иконкой
// по центру, никогда не фигура). Владелец кладёт блок на стык двух секций
// с разным фоном — сам блок прозрачен везде, кроме самой фигуры, поэтому
// секция ПОД ним просвечивает через него как обычно, а фигура рисуется
// цветом `props.color` поверх (обычно — тем же цветом, что фон СЛЕДУЮЩЕЙ
// секции, тогда фигура выглядит как её же выступающий край, а не отдельный
// элемент). Никакого прева не задаём (`previewIcon` не установлен) —
// `BlockThumbnail` сам живьём рендерит `defaultProps` для превью в
// библиотеке, как для любого не-структурного блока без своих данных.

type ShapeDividerShape = 'wave' | 'blob' | 'triangle';
type ShapeDividerHeight = 'sm' | 'md' | 'lg' | 'xl';

interface ShapeDividerProps {
  shape: ShapeDividerShape;
  color: string;
  height: ShapeDividerHeight;
  /** Зеркалит фигуру по вертикали — тот же разделитель, но для верхнего,
   * а не нижнего края секции. */
  flip: boolean;
  /** Бесшовная бегущая волна (см. `layout.module.scss`,
   * `.shape-divider__track--second` + keyframes) — осмысленно только для
   * `shape: 'wave'`, для `blob`/`triangle` тихо ничего не меняет: не стоило
   * заводить отдельное поле `showIf` (в реестре блоков такого механизма
   * нет вообще ни у одного поля) ради одного частного случая. */
  animated: boolean;
}

const SHAPE_DIVIDER_HEIGHT_PX: Record<ShapeDividerHeight, number> = {
  sm: 60,
  md: 100,
  lg: 140,
  xl: 180,
};

/** Все три — в единой системе координат `viewBox="0 0 1200 120"`,
 * `preserveAspectRatio="none"` (растягивается на всю ширину блока, форма
 * не обязана быть пропорциональной). У `wave` начало и конец пути лежат на
 * одной высоте (y=64) — это то, что даёт бесшовный стык при бегущей
 * анимации (`.shape-divider__track--second`, см. ниже), у `blob`/`triangle`
 * это не нужно, они никогда не анимируются. */
const SHAPE_DIVIDER_PATHS: Record<ShapeDividerShape, string> = {
  wave: 'M0,64 C300,120 600,0 900,64 C1050,96 1150,80 1200,64 L1200,120 L0,120 Z',
  blob: 'M0,20 C300,100 700,0 1000,50 C1080,66 1140,70 1200,60 L1200,120 L0,120 Z',
  triangle: 'M0,120 L600,10 L1200,120 Z',
};

function ShapeDividerRenderer({ props }: BlockRendererProps<ShapeDividerProps>) {
  const isAnimatedWave = props.animated && props.shape === 'wave';
  return (
    <div
      className={styles['shape-divider']}
      style={{
        height: SHAPE_DIVIDER_HEIGHT_PX[props.height],
        transform: props.flip ? 'scaleY(-1)' : undefined,
      }}
      aria-hidden="true"
    >
      <svg
        className={cn(
          styles['shape-divider__track'],
          isAnimatedWave && styles['shape-divider__track--animated'],
        )}
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
      >
        <path d={SHAPE_DIVIDER_PATHS[props.shape]} fill={props.color} />
      </svg>
      {isAnimatedWave && (
        <svg
          className={cn(
            styles['shape-divider__track'],
            styles['shape-divider__track--second'],
            styles['shape-divider__track--animated'],
          )}
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path d={SHAPE_DIVIDER_PATHS.wave} fill={props.color} />
        </svg>
      )}
    </div>
  );
}

const shapeDividerFields: FieldSchema[] = [
  {
    key: 'shape',
    label: 'Форма',
    control: 'select',
    options: [
      { value: 'wave', label: 'Волна' },
      { value: 'blob', label: 'Капля' },
      { value: 'triangle', label: 'Треугольник' },
    ],
  },
  { key: 'color', label: 'Цвет фигуры', control: 'color' },
  {
    key: 'height',
    label: 'Высота',
    control: 'select',
    options: [
      { value: 'sm', label: 'Маленькая' },
      { value: 'md', label: 'Средняя' },
      { value: 'lg', label: 'Большая' },
      { value: 'xl', label: 'Очень большая' },
    ],
  },
  { key: 'flip', label: 'Отразить по вертикали', control: 'toggle' },
  { key: 'animated', label: 'Плавное движение (для волны)', control: 'toggle' },
];

registerBlock<ShapeDividerProps>({
  type: 'shapedivider',
  label: 'Фигурный разделитель',
  category: 'layout',
  icon: WaveIcon,
  description: 'Волна, капля или треугольник между секциями — не просто линия',
  defaultProps: { shape: 'wave', color: '#2563eb', height: 'md', flip: false, animated: true },
  fields: shapeDividerFields,
  Renderer: ShapeDividerRenderer,
});
