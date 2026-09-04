import { QuoteIcon, RowsIcon, TagIcon } from '@/shared/ui/icons';
import {
  readResponsiveProp,
  registerBlock,
  type BlockRendererProps,
  type FieldSchema,
} from '../../model/registry';
import type { ResponsiveValue } from '../../model/types';
import { EditableRichText } from '../../ui/EditableRichText';
import { EditableText } from '../../ui/EditableText';
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

function HeadingRenderer({
  props,
  viewport,
  isEditing,
  onEditProp,
}: BlockRendererProps<HeadingProps>) {
  const Tag = props.level;
  const sizeKey = readResponsiveProp(props.size, viewport, 'md');
  return (
    <EditableText
      as={Tag}
      value={props.text}
      editable={Boolean(isEditing && onEditProp)}
      onCommit={(next) => onEditProp?.('text', next)}
      placeholder="Заголовок раздела"
      className={styles.heading}
      style={{
        fontSize: HEADING_SIZE_PX[sizeKey] ?? HEADING_SIZE_PX.md,
        color: colorVar(props.color),
      }}
    />
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

function TextRenderer({ props, isEditing, onEditProp }: BlockRendererProps<TextProps>) {
  return (
    <EditableRichText
      value={props.text}
      editable={Boolean(isEditing && onEditProp)}
      onCommit={(next) => onEditProp?.('text', next)}
      placeholder="Расскажите о своём деле в паре предложений."
      className={styles.text}
      style={{ color: colorVar(props.color) }}
    />
  );
}

// Своего поля `text` в форме инспектора больше нет — редактируется кликом
// прямо по тексту на холсте (`EditableRichText`), см. форвард-комментарий у
// `richtext` ниже про то, почему у этих трёх типов текстовое поле — только
// на холсте, не дублируется в форме.
const textFields: FieldSchema[] = [
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
  defaultProps: { text: '<p>Расскажите о своём деле в паре предложений.</p>', color: 'default' },
  fields: textFields,
  Renderer: TextRenderer,
});

// --- RichText --------------------------------------------------------------
// Настоящий форматированный текст (жирный/курсив/ссылка) через инлайн-
// редактор на холсте (`EditableRichText`, кликните прямо по тексту) — то же
// решение, что и у `text`/`quote` ниже, см. форвард-комментарий у `Editable
// RichText` (`entities/website/ui/EditableRichText.tsx`) про переиспользование
// Tiptap-редактора постов (`features/publish-post`) и санитизацию на backend
// (`sanitizeRichBlockText`, `WebsitesService.saveDraft`) — то, чего раньше
// здесь сознательно не было (см. AI_PLATFORM_ROADMAP.md, «билдер для
// новичка»). Собственного поля в форме инспектора у `text` больше нет —
// единственный способ его редактировать теперь клик по самому тексту на
// холсте, чтобы не завести два независимых редактора одного и того же поля
// с разной моделью хранения (HTML на холсте, обычная строка в форме).

interface RichTextProps {
  text: string;
}

function RichTextRenderer({ props, isEditing, onEditProp }: BlockRendererProps<RichTextProps>) {
  return (
    <EditableRichText
      value={props.text}
      editable={Boolean(isEditing && onEditProp)}
      onCommit={(next) => onEditProp?.('text', next)}
      placeholder="Первый абзац рассказывает главное."
      className={styles.richtext}
    />
  );
}

registerBlock<RichTextProps>({
  type: 'richtext',
  label: 'Длинный текст',
  category: 'typography',
  icon: RowsIcon,
  description: 'Развёрнутый текст в несколько абзацев',
  defaultProps: {
    text: '<p>Первый абзац рассказывает главное.</p><p>Второй абзац добавляет подробности — историю, ценности или то, чем вы отличаетесь.</p>',
  },
  fields: [],
  Renderer: RichTextRenderer,
});

// --- Quote -----------------------------------------------------------------

interface QuoteProps {
  text: string;
  author: string;
}

function QuoteRenderer({ props, isEditing, onEditProp }: BlockRendererProps<QuoteProps>) {
  const editable = Boolean(isEditing && onEditProp);
  return (
    <blockquote className={styles.quote}>
      <QuoteIcon className={styles.quote__icon} />
      <EditableRichText
        value={props.text}
        editable={editable}
        onCommit={(next) => onEditProp?.('text', next)}
        placeholder="Отличный сервис и внимание к деталям."
        className={styles.quote__text}
      />
      {(props.author || editable) && (
        <EditableText
          as="footer"
          value={props.author}
          editable={editable}
          onCommit={(next) => onEditProp?.('author', next)}
          placeholder="Имя, компания"
          className={styles.quote__author}
        />
      )}
    </blockquote>
  );
}

// `text` (сама цитата) больше не редактируется в форме — теперь это HTML
// через `EditableRichText` на холсте (см. форвард-комментарий у `richtext`
// выше). `author` остаётся — простая строка что там, что там, формат не
// расходится, дублирование безопасно.
const quoteFields: FieldSchema[] = [{ key: 'author', label: 'Автор', control: 'text' }];

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
