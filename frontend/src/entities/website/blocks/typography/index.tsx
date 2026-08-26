import { QuoteIcon, RowsIcon, TagIcon } from '@/shared/ui/icons';
import {
  readResponsiveProp,
  registerBlock,
  type BlockRendererProps,
  type FieldSchema,
} from '../../model/registry';
import type { ResponsiveValue } from '../../model/types';
import styles from './typography.module.scss';

type TextColor = 'default' | 'primary' | 'muted';

function colorVar(color: TextColor | undefined): string | undefined {
  if (color === 'primary') return 'var(--site-primary)';
  if (color === 'muted') return 'var(--site-muted)';
  return undefined;
}

// --- Heading -----------------------------------------------------------

type HeadingSize = 'sm' | 'md' | 'lg' | 'xl';

interface HeadingProps {
  text: string;
  level: 'h1' | 'h2' | 'h3';
  size: ResponsiveValue<HeadingSize>;
  color: TextColor;
}

const HEADING_SIZE_PX: Record<string, string> = {
  sm: '22px',
  md: '30px',
  lg: '40px',
  xl: '56px',
};

function HeadingRenderer({ props, viewport }: BlockRendererProps<HeadingProps>) {
  const Tag = props.level;
  const sizeKey = readResponsiveProp(props.size, viewport, 'md');
  return (
    <Tag
      className={styles.heading}
      style={{
        fontSize: HEADING_SIZE_PX[sizeKey] ?? HEADING_SIZE_PX.md,
        color: colorVar(props.color),
      }}
    >
      {props.text}
    </Tag>
  );
}

const headingFields: FieldSchema[] = [
  { key: 'text', label: 'Текст', control: 'text' },
  {
    key: 'level',
    label: 'Тег заголовка',
    control: 'select',
    options: [
      { value: 'h1', label: 'H1 — главный' },
      { value: 'h2', label: 'H2 — раздел' },
      { value: 'h3', label: 'H3 — подраздел' },
    ],
    hint: 'Влияет на SEO-структуру страницы, не только на размер',
  },
  {
    key: 'size',
    label: 'Размер',
    control: 'select',
    responsive: true,
    options: [
      { value: 'sm', label: 'Маленький' },
      { value: 'md', label: 'Средний' },
      { value: 'lg', label: 'Крупный' },
      { value: 'xl', label: 'Очень крупный' },
    ],
    hint: 'Можно задать свой размер для планшета и телефона',
  },
  {
    key: 'color',
    label: 'Цвет',
    control: 'select',
    options: [
      { value: 'default', label: 'Обычный' },
      { value: 'primary', label: 'Акцентный' },
      { value: 'muted', label: 'Приглушённый' },
    ],
  },
];

registerBlock<HeadingProps>({
  type: 'heading',
  label: 'Заголовок',
  category: 'typography',
  icon: RowsIcon,
  description: 'Крупный заголовок раздела',
  defaultProps: {
    text: 'Заголовок раздела',
    level: 'h2',
    size: { desktop: 'md' },
    color: 'default',
  },
  fields: headingFields,
  Renderer: HeadingRenderer,
});

// --- Text ----------------------------------------------------------------

interface TextProps {
  text: string;
  color: TextColor;
}

function TextRenderer({ props }: BlockRendererProps<TextProps>) {
  return (
    <p className={styles.text} style={{ color: colorVar(props.color) }}>
      {props.text}
    </p>
  );
}

const textFields: FieldSchema[] = [
  { key: 'text', label: 'Текст', control: 'textarea', rows: 3 },
  {
    key: 'color',
    label: 'Цвет',
    control: 'select',
    options: [
      { value: 'default', label: 'Обычный' },
      { value: 'primary', label: 'Акцентный' },
      { value: 'muted', label: 'Приглушённый' },
    ],
  },
];

registerBlock<TextProps>({
  type: 'text',
  label: 'Текст',
  category: 'typography',
  icon: TagIcon,
  description: 'Обычный абзац текста',
  defaultProps: { text: 'Расскажите о своём деле в паре предложений.', color: 'default' },
  fields: textFields,
  Renderer: TextRenderer,
});

// --- RichText --------------------------------------------------------------
// Упрощённая версия «форматированного текста» для MVP — обычный plain-text
// с сохранением переносов строк/абзацев (`white-space: pre-wrap`), НЕ HTML
// через `dangerouslySetInnerHTML`. Полноценный WYSIWYG (как у Tiptap-
// редактора постов, `features/publish-post`) требовал бы своей санитизации
// на backend перед сохранением — тот же уровень работы, что и весь
// remaining builder, поэтому осознанно отложено (см. корневой план фичи,
// раздел про упрощения MVP). React сам экранирует текстовое содержимое —
// здесь нет риска инъекции разметки, даже если пользователь напишет что-то
// похожее на тег.

interface RichTextProps {
  text: string;
}

function RichTextRenderer({ props }: BlockRendererProps<RichTextProps>) {
  return <div className={styles.richtext}>{props.text}</div>;
}

const richTextFields: FieldSchema[] = [
  { key: 'text', label: 'Текст', control: 'textarea', rows: 8 },
];

registerBlock<RichTextProps>({
  type: 'richtext',
  label: 'Длинный текст',
  category: 'typography',
  icon: RowsIcon,
  description: 'Развёрнутый текст в несколько абзацев',
  defaultProps: {
    text: 'Первый абзац рассказывает главное.\n\nВторой абзац добавляет подробности — историю, ценности или то, чем вы отличаетесь.',
  },
  fields: richTextFields,
  Renderer: RichTextRenderer,
});

// --- Quote -----------------------------------------------------------------

interface QuoteProps {
  text: string;
  author: string;
}

function QuoteRenderer({ props }: BlockRendererProps<QuoteProps>) {
  return (
    <blockquote className={styles.quote}>
      <QuoteIcon className={styles.quote__icon} />
      <p className={styles.quote__text}>{props.text}</p>
      {props.author && <footer className={styles.quote__author}>{props.author}</footer>}
    </blockquote>
  );
}

const quoteFields: FieldSchema[] = [
  { key: 'text', label: 'Цитата', control: 'textarea', rows: 3 },
  { key: 'author', label: 'Автор', control: 'text' },
];

registerBlock<QuoteProps>({
  type: 'quote',
  label: 'Цитата',
  category: 'typography',
  icon: QuoteIcon,
  description: 'Выделенная цитата с указанием автора',
  defaultProps: { text: 'Отличный сервис и внимание к деталям.', author: 'Имя, компания' },
  fields: quoteFields,
  Renderer: QuoteRenderer,
});
