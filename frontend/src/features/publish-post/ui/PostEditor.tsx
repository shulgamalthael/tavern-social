'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import TiptapImage from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import type { Post } from '@/entities/post';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import {
  Div,
  InlineStyle,
  Span,
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableHeader,
  TableRow,
} from '../lib/rich-html-extensions';
import styles from './PostEditor.module.scss';

/** Те же правила, что и multer на backend (`common/lib/upload.ts`) —
 * проверяем на клиенте заранее, чтобы не тратить впустую загрузку файла,
 * который backend всё равно отклонит. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
/** Тот же потолок, что и `MAX_POST_IMAGES` в backend `PostsService`. */
const MAX_POST_IMAGES = 10;

export interface PostEditorProps {
  mode: 'create' | 'edit';
  /** Исходный пост для режима редактирования — текст/ссылки/картинки
   * загружаются в редактор как есть (существующие картинки уже имеют
   * настоящий `/uploads/posts/...` src, редактор их не трогает). */
  post?: Post;
  onSubmit: (input: { text: string; images: File[] }) => Promise<void>;
  /** Только для режима редактирования — создание всегда видимо в композере,
   * отменять нечего (см. AGENTS.md, `PostComposer`). */
  onCancel?: () => void;
  submitLabel?: string;
  pendingLabel?: string;
  placeholder?: string;
}

function countImages(html: string): number {
  return (html.match(/<img\b/g) ?? []).length;
}

function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) return raw;
  return `https://${raw}`;
}

/** Заменяет локальные `blob:`-превью только что вставленных картинок на
 * плейсхолдеры `attachment:N`, которые backend подставит на реальные URL
 * после сохранения файлов (см. `common/lib/post-image-placeholders.ts` на
 * backend) — собирает и сами файлы, в том же порядке. Уже существующие
 * картинки (режим редактирования, настоящий `/uploads/posts/...` src) эта
 * подстановка не касается. */
function buildSubmissionContent(
  html: string,
  filesByBlobUrl: Map<string, File>,
): { text: string; images: File[] } {
  const images: File[] = [];
  let index = 0;
  const text = html.replace(/src="(blob:[^"]+)"/g, (match, blobUrl: string) => {
    const file = filesByBlobUrl.get(blobUrl);
    if (!file) return match;
    images.push(file);
    return `src="attachment:${index++}"`;
  });
  return { text, images };
}

/**
 * Редактор поста — одна реализация для создания и редактирования (`mode`),
 * а не два похожих компонента (см. план задачи, раздел про PostEditor).
 * Tiptap выбран из-за требуемого набора форматирования (жирный/курсив/
 * подчёркивание/заголовки/списки/ссылки) и позиционируемых картинок прямо в
 * тексте — надёжная реализация этого набора без готового редактора означала
 * бы хрупкий самодельный `contentEditable`+`execCommand`.
 */
export function PostEditor({
  mode,
  post,
  onSubmit,
  onCancel,
  submitLabel = 'Опубликовать',
  pendingLabel = 'Публикуем…',
  placeholder = 'О чём расскажешь залу?',
}: PostEditorProps) {
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isHtmlSourceOpen, setHtmlSourceOpen] = useState(false);
  const [htmlSource, setHtmlSource] = useState('');
  const filesByBlobUrl = useRef(new Map<string, File>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TiptapImage.configure({ inline: false }),
      Div,
      InlineStyle,
      Span,
      Table,
      TableHead,
      TableBody,
      TableFoot,
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: post?.text ?? '',
    editorProps: {
      attributes: { class: styles['editor__prose'] },
    },
  });

  useEffect(
    () => () => {
      // Отзываем все ещё не отправленные локальные превью при размонтировании
      // (отмена редактирования/уход со страницы) — иначе объекты остаются в
      // памяти вкладки до её закрытия.
      filesByBlobUrl.current.forEach((_file, url) => URL.revokeObjectURL(url));
    },
    [],
  );

  // Клик вне редактора сворачивает его обратно (см. `PostComposer` — там
  // это и есть переключение развёрнуто/свёрнуто), но только пока в нём
  // ничего не набрано — случайный клик мимо не должен молча стирать
  // начатый черновик. Явная кнопка «Отмена» ниже не имеет этого
  // ограничения, срабатывает всегда. Только для `onCancel`, который передан
  // — режимы без него (пока такого нет) просто не разворачивают
  // управление извне.
  useEffect(() => {
    if (!editor || !onCancel) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (editorRootRef.current?.contains(event.target as Node)) return;
      if (!editor.isEmpty) return;
      onCancel();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [editor, onCancel]);

  if (!editor) return null;

  const openLinkPopover = () => {
    setError(null);
    const { from, to } = editor.state.selection;
    if (editor.isActive('link')) {
      editor.chain().extendMarkRange('link').run();
      const range = editor.state.selection;
      setLinkText(editor.state.doc.textBetween(range.from, range.to));
      setLinkUrl((editor.getAttributes('link').href as string | undefined) ?? '');
    } else {
      setLinkText(editor.state.doc.textBetween(from, to));
      setLinkUrl('');
    }
    setLinkPopoverOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const label = linkText.trim() || url;
    const href = normalizeUrl(url);
    const { from } = editor.state.selection;

    editor.chain().focus().deleteSelection().insertContent(label).run();
    editor
      .chain()
      .setTextSelection({ from, to: from + label.length })
      .extendMarkRange('link')
      .setLink({ href })
      .setTextSelection(from + label.length)
      .run();
    setLinkPopoverOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkPopoverOpen(false);
  };

  const openHtmlSource = () => {
    setError(null);
    setHtmlSource(editor.getHTML());
    setHtmlSourceOpen(true);
  };

  /** Разбирает вручную введённый/вставленный HTML по той же схеме, что и
   * обычная вставка из буфера — теги/атрибуты вне allowlist редактора
   * (см. StarterKit/Image выше) просто отбрасываются, а не сохраняются как
   * есть, поэтому результат уже соответствует тому, что допустит
   * санитайзер на backend. */
  const applyHtmlSource = () => {
    editor.commands.setContent(htmlSource);
    setHtmlSourceOpen(false);
  };

  const onImageButtonClick = () => fileInputRef.current?.click();

  const onImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
      setError('Допустимы только изображения JPEG, PNG и WebP');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Изображение слишком большое — до 5 МБ');
      return;
    }
    if (countImages(editor.getHTML()) >= MAX_POST_IMAGES) {
      setError(`В записи может быть не больше ${MAX_POST_IMAGES} изображений`);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    filesByBlobUrl.current.set(blobUrl, file);
    editor.chain().focus().setImage({ src: blobUrl, alt: '' }).run();
  };

  const submit = async () => {
    if (isPending || editor.isEmpty) return;
    setPending(true);
    setError(null);
    try {
      const { text, images } = buildSubmissionContent(editor.getHTML(), filesByBlobUrl.current);
      await onSubmit({ text, images });
      if (mode === 'create') {
        editor.commands.clearContent();
        filesByBlobUrl.current.forEach((_file, url) => URL.revokeObjectURL(url));
        filesByBlobUrl.current.clear();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить запись');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.editor} ref={editorRootRef}>
      <div className={styles['editor__toolbar']} role="toolbar" aria-label="Форматирование текста">
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('bold') && styles['editor__tool--active'],
          )}
          aria-label="Жирный"
          aria-pressed={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>Ж</strong>
        </button>
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('italic') && styles['editor__tool--active'],
          )}
          aria-label="Курсив"
          aria-pressed={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>К</em>
        </button>
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('underline') && styles['editor__tool--active'],
          )}
          aria-label="Подчёркнутый"
          aria-pressed={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>П</u>
        </button>
        <span className={styles['editor__divider']} aria-hidden="true" />
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('heading', { level: 2 }) && styles['editor__tool--active'],
          )}
          aria-label="Заголовок"
          aria-pressed={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('heading', { level: 3 }) && styles['editor__tool--active'],
          )}
          aria-label="Подзаголовок"
          aria-pressed={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <span className={styles['editor__divider']} aria-hidden="true" />
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('bulletList') && styles['editor__tool--active'],
          )}
          aria-label="Маркированный список"
          aria-pressed={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ●&nbsp;―
        </button>
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('orderedList') && styles['editor__tool--active'],
          )}
          aria-label="Нумерованный список"
          aria-pressed={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.―
        </button>
        <span className={styles['editor__divider']} aria-hidden="true" />
        <button
          type="button"
          className={cn(
            styles['editor__tool'],
            editor.isActive('link') && styles['editor__tool--active'],
          )}
          aria-label="Ссылка"
          onClick={openLinkPopover}
        >
          Ссылка
        </button>
        <button
          type="button"
          className={styles['editor__tool']}
          aria-label="Изображение"
          onClick={onImageButtonClick}
        >
          Фото
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles['editor__file-input']}
          onChange={onImageFileChange}
        />
        <span className={styles['editor__divider']} aria-hidden="true" />
        <button
          type="button"
          className={cn(styles['editor__tool'], isHtmlSourceOpen && styles['editor__tool--active'])}
          aria-label="HTML-код"
          aria-pressed={isHtmlSourceOpen}
          onClick={() => (isHtmlSourceOpen ? setHtmlSourceOpen(false) : openHtmlSource())}
        >
          HTML
        </button>
      </div>

      {isHtmlSourceOpen && (
        <div className={styles['editor__html-source']}>
          <textarea
            className={styles['editor__html-textarea']}
            value={htmlSource}
            onChange={(event) => setHtmlSource(event.target.value)}
            placeholder="<p>Вставьте или напишите HTML — он превратится в обычный форматированный текст записи</p>"
            rows={6}
            spellCheck={false}
          />
          <div className={styles['editor__link-actions']}>
            <Button variant="outline" onClick={() => setHtmlSourceOpen(false)}>
              Отмена
            </Button>
            <Button onClick={applyHtmlSource}>Применить</Button>
          </div>
        </div>
      )}

      {isLinkPopoverOpen && !isHtmlSourceOpen && (
        <div className={styles['editor__link-popover']}>
          <label className={styles['editor__link-field']}>
            <span>Текст ссылки</span>
            <input
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
              placeholder="Например, Посмотреть проект"
            />
          </label>
          <label className={styles['editor__link-field']}>
            <span>URL</span>
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://example.com"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
              }}
            />
          </label>
          <div className={styles['editor__link-actions']}>
            {editor.isActive('link') && (
              <Button variant="ghost" onClick={removeLink}>
                Удалить ссылку
              </Button>
            )}
            <Button variant="outline" onClick={() => setLinkPopoverOpen(false)}>
              Отмена
            </Button>
            <Button onClick={applyLink} disabled={!linkUrl.trim()}>
              Применить
            </Button>
          </div>
        </div>
      )}

      <EditorContent
        editor={editor}
        className={cn(
          styles['editor__content'],
          isHtmlSourceOpen && styles['editor__content--hidden'],
        )}
        aria-label={placeholder}
      />

      {error && <p className={styles['editor__error']}>{error}</p>}

      <div className={styles['editor__actions']}>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Отмена
          </Button>
        )}
        <Button
          className={styles['editor__submit']}
          onClick={() => void submit()}
          disabled={isPending}
        >
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
