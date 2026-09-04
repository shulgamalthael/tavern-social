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
} from '@/shared/ui/icons';
import { SPACING_PX } from '../../model/theme-tokens';
import type { BlockRendererProps, FieldSchema } from '../../model/registry';
import { registerBlock } from '../../model/registry';
import type { SpacingSize } from '../../model/types';
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
