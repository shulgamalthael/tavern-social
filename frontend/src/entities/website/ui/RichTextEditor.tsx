'use client';

import { useEffect, type CSSProperties } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { cn } from '@/shared/lib/cn';
import styles from './EditableRichText.module.scss';

/** Только то, что нужно для форматирования КОРОТКОГО текстового блока
 * (жирный/курсив/ссылка) — сознательно НЕ весь `StarterKit` (заголовки/
 * списки/цитаты/код не нужны внутри текстового блока сайта, за них отвечают
 * другие поля/другие типы блоков). `undoRedo: false` — у Tiptap есть
 * собственный стек истории поверх ProseMirror-документа, но в билдере уже
 * есть один общий Undo/Redo на весь документ (`useWebsiteBuilderStore`,
 * кнопки в `BuilderToolbar.tsx`) — два независимых стека истории одновременно
 * запутали бы пользователя (Ctrl+Z внутри текста ничего не делает для
 * основного Undo и наоборот); коммит только по blur/Escape ниже и так даёт
 * достаточно защиты от случайного ввода. */
const EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    undoRedo: false,
    link: { openOnClick: false, autolink: true },
  }),
];

export interface RichTextEditorProps {
  initialValue: string;
  className?: string;
  style?: CSSProperties;
  onCommit: (html: string) => void;
  onCancel: () => void;
}

/**
 * Смонтирован ТОЛЬКО пока блок реально редактируется (`EditableRichText`
 * рендерит его условно) — не держим лишний Tiptap-инстанс на каждый
 * текстовый блок страницы, только на тот, который сейчас открыт. Тулбар —
 * всплывающий по выделению текста (`BubbleMenu`), не постоянная панель, как
 * у `features/publish-post/ui/PostEditor.tsx` (там она уместна — отдельный
 * полноэкранный редактор поста; здесь блок маленький, постоянная панель
 * была бы слишком тяжёлой).
 */
export function RichTextEditor({
  initialValue,
  className,
  style,
  onCommit,
  onCancel,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: EXTENSIONS,
    content: initialValue,
    editorProps: { attributes: { class: styles.prose } },
    onBlur: ({ editor: current }) => onCommit(current.getHTML()),
  });

  useEffect(() => {
    editor?.chain().focus('end').run();
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }
    const dom = editor.view.dom;
    dom.addEventListener('keydown', onKeyDown);
    return () => dom.removeEventListener('keydown', onKeyDown);
  }, [editor, onCancel]);

  if (!editor) return null;

  return (
    <div className={cn(className, styles.editing)} style={style}>
      <BubbleMenu editor={editor} className={styles.bubbleMenu}>
        <button
          type="button"
          className={cn(
            styles.bubbleButton,
            editor.isActive('bold') && styles['bubbleButton--active'],
          )}
          aria-label="Жирный"
          aria-pressed={editor.isActive('bold')}
          // `preventDefault` на mousedown — иначе клик по кнопке сначала
          // снимает фокус с редактора (стандартное поведение браузера при
          // клике вне текущего сфокусированного элемента), а `onBlur` ВЫШЕ
          // уже закоммитил бы и размонтировал редактор раньше, чем успеет
          // сработать сам клик.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>Ж</strong>
        </button>
        <button
          type="button"
          className={cn(
            styles.bubbleButton,
            editor.isActive('italic') && styles['bubbleButton--active'],
          )}
          aria-label="Курсив"
          aria-pressed={editor.isActive('italic')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>К</em>
        </button>
        <button
          type="button"
          className={cn(
            styles.bubbleButton,
            editor.isActive('link') && styles['bubbleButton--active'],
          )}
          aria-label="Ссылка"
          aria-pressed={editor.isActive('link')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt('Ссылка (https://…)');
            if (!url) return;
            editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Ссылка
        </button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
