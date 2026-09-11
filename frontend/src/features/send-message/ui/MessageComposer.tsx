'use client';

import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useThreadStore } from '@/entities/thread';
import { cn } from '@/shared/lib/cn';
import { formatFileSize } from '@/shared/lib/format-file-size';
import {
  AttachmentIcon,
  CheckIcon,
  CloseIcon,
  EmojiIcon,
  FileIcon,
  ReplyIcon,
  SendIcon,
  UploadIcon,
} from '@/shared/ui/icons';
import { EmojiPicker } from './EmojiPicker';
import styles from './MessageComposer.module.scss';

export interface MessageComposerProps {
  /** `null` — черновик (`useThreadStore.draftTarget`): диалог ещё не
   * создан, `sendMessage` заведёт его вместе с этим сообщением. */
  threadId: string | null;
}

/** То же ограничение, что и на backend (`MAX_IMAGE_BYTES` в
 * `common/lib/upload.ts`) — проверка здесь только ради быстрой обратной
 * связи, backend всё равно перепроверяет сам как последний рубеж. */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

/** Потолок высоты поля ввода при автоподросте под многострочный текст —
 * дальше сам textarea начинает скроллиться внутри себя, а не растягивать
 * композер (и с ним весь чат) до бесконечности. */
const MAX_TEXTAREA_HEIGHT = 160;

export function MessageComposer({ threadId }: MessageComposerProps) {
  const sendMessage = useThreadStore((state) => state.sendMessage);
  const editingMessage = useThreadStore((state) => state.editingMessage);
  const editMessage = useThreadStore((state) => state.editMessage);
  const cancelEditingMessage = useThreadStore((state) => state.cancelEditingMessage);
  const replyingTo = useThreadStore((state) => state.replyingTo);
  const cancelReplyingToMessage = useThreadStore((state) => state.cancelReplyingToMessage);

  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isDraggingOver, setDraggingOver] = useState(false);
  // Какое редактируемое сообщение уже отражено в `draft` — используется
  // ниже, чтобы синхронизировать `draft` при смене редактируемого сообщения
  // без эффекта (см. https://react.dev/learn/you-might-not-need-an-effect
  // «Adjusting state based on a prop change»): `setDraft` вызывается прямо в
  // теле рендера, React обработает это как повторный рендер до коммита.
  const [syncedEditMessageId, setSyncedEditMessageId] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  // Счётчик вложенности drag-событий — `dragenter`/`dragleave` срабатывают
  // на каждом дочернем узле композера отдельно, обычная проверка «покинули
  // контейнер» по одному `dragleave` мигала бы подсветкой при пересечении
  // границ дочерних элементов внутри одного и того же перетаскивания.
  const dragDepth = useRef(0);

  const isEditing = editingMessage !== null && editingMessage.threadId === threadId;
  // Взаимоисключающе с редактированием — стор сам сбрасывает одно при
  // старте другого (см. `startEditingMessage`/`startReplyingToMessage`),
  // `!isEditing` здесь просто защита на случай гонки двух состояний.
  const isReplying = !isEditing && replyingTo !== null && replyingTo.threadId === threadId;
  // Вложения (drag&drop, paste, кнопка-скрепка) не имеют смысла в режиме
  // редактирования — backend меняет только текст (см. `ThreadsService.
  // editMessage`), набор файлов уже отправленного сообщения неизменен.
  const canAttach = !isEditing;
  // Кнопка-самолётик активна, только когда есть что отправить — то же
  // условие, что и ранний `return` в `submit` ниже, просто отражённое в
  // виде явного `disabled`, а не только в поведении по клику: неактивная
  // (тусклая) кнопка сама подсказывает, что печатать/прикреплять ещё
  // нечего, вместо кликабельной с виду кнопки, которая молча ничего не
  // делает.
  const canSubmit = isEditing
    ? draft.trim().length > 0
    : draft.trim().length > 0 || files.length > 0;

  if (isEditing && editingMessage.messageId !== syncedEditMessageId) {
    setSyncedEditMessageId(editingMessage.messageId);
    setDraft(editingMessage.text);
  }

  // Локальные превью для картинок-вложений — `URL.createObjectURL` создаёт
  // объект в памяти вкладки, освобождается явно в cleanup эффекта, иначе
  // живёт до закрытия страницы даже после того, как файл убрали из списка.
  const previewUrls = useMemo(
    () => files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : '')),
    [files],
  );
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  useEffect(() => {
    if (!isPickerOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!emojiContainerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isPickerOpen]);

  // Автоподрост textarea под содержимое — высота сбрасывается в `auto`
  // перед измерением `scrollHeight`, иначе при удалении текста высота
  // «залипает» на прежнем (большем) значении: браузер меряет `scrollHeight`
  // относительно уже выставленной высоты, а не содержимого.
  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [draft]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isEditing && editingMessage) {
      if (!draft.trim()) return;
      void editMessage(editingMessage.threadId, editingMessage.messageId, draft);
      setDraft('');
      return;
    }
    if (!draft.trim() && files.length === 0) return;
    void sendMessage(threadId, draft, files, isReplying ? replyingTo.messageId : undefined);
    setDraft('');
    setFiles([]);
  };

  // Enter отправляет (как форму — тот же путь, что и клик по кнопке),
  // Shift+Enter — обычный перенос строки, стандартное поведение textarea,
  // здесь ничего не перехватывается. `isComposing` — на середине набора
  // через IME (китайская/японская раскладка) Enter подтверждает вариант
  // символа, а не должен отправлять ещё не законченное сообщение.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    formRef.current?.requestSubmit();
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setDraft((current) => current + emoji);
      return;
    }
    const start = input.selectionStart ?? draft.length;
    const end = input.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      const caret = start + emoji.length;
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  };

  const addFiles = (chosen: File[]) => {
    if (!canAttach || chosen.length === 0) return;
    const tooBig = chosen.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) {
      setAttachmentError(`Файл «${tooBig.name}» больше 5 МБ`);
      return;
    }
    setAttachmentError(null);
    setFiles((current) => [...current, ...chosen].slice(0, MAX_ATTACHMENTS));
  };

  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    addFiles(chosen);
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  // Вставка картинки из буфера обмена (скриншот, скопированное изображение)
  // — только если в буфере правда файл-картинка, иначе обычная текстовая
  // вставка идёт своим чередом без вмешательства.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canAttach) return;
    const imageFiles = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (imageFiles.length === 0) return;
    event.preventDefault();
    addFiles(imageFiles);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDraggingOver(true);
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach || !event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDraggingOver(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!canAttach) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDraggingOver(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      className={styles.composer}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDraggingOver && (
        <div className={styles['composer__drop-overlay']}>
          <UploadIcon />
          Отпустите, чтобы прикрепить
        </div>
      )}

      {isEditing && (
        <div className={styles['composer__banner']}>
          <span>Редактирование сообщения</span>
          <button
            type="button"
            className={styles['composer__banner-cancel']}
            onClick={() => {
              cancelEditingMessage();
              setDraft('');
            }}
          >
            Отмена
          </button>
        </div>
      )}

      {isReplying && (
        <div className={cn(styles['composer__banner'], styles['composer__banner--reply'])}>
          <ReplyIcon className={styles['composer__banner-icon']} />
          <span className={styles['composer__banner-body']}>
            <span className={styles['composer__banner-title']}>Ответ {replyingTo.senderName}</span>
            <span className={styles['composer__banner-preview']}>
              {replyingTo.text || (replyingTo.hasAttachment ? 'Вложение' : '')}
            </span>
          </span>
          <button
            type="button"
            className={styles['composer__banner-cancel']}
            onClick={cancelReplyingToMessage}
            aria-label="Отменить ответ"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {attachmentError && <p className={styles['composer__error']}>{attachmentError}</p>}

      {files.length > 0 && (
        <div className={styles['composer__attachments']}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className={styles['composer__attachment']}>
              {previewUrls[index] ? (
                // eslint-disable-next-line @next/next/no-img-element -- локальный blob-превью выбранного файла до отправки, не подходит под next/image
                <img
                  src={previewUrls[index]}
                  alt=""
                  className={styles['composer__attachment-thumb']}
                />
              ) : (
                <FileIcon className={styles['composer__attachment-icon']} />
              )}
              <span className={styles['composer__attachment-name']}>{file.name}</span>
              <span className={styles['composer__attachment-size']}>
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                className={styles['composer__attachment-remove']}
                onClick={() => removeFile(index)}
                aria-label={`Убрать файл ${file.name}`}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <form className={styles['composer__row']} onSubmit={submit} ref={formRef}>
        <button
          type="button"
          className={styles['composer__icon-button']}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Прикрепить файл"
          disabled={!canAttach}
        >
          <AttachmentIcon />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles['composer__file-input']}
          onChange={onFilesChosen}
          tabIndex={-1}
        />

        <div className={styles['composer__field']} ref={emojiContainerRef}>
          <textarea
            ref={inputRef}
            rows={1}
            className={styles['composer__input']}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={isEditing ? 'Изменить сообщение…' : 'Подсесть к разговору…'}
          />
          <button
            type="button"
            className={styles['composer__emoji-button']}
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="Эмодзи"
            aria-expanded={isPickerOpen}
          >
            <EmojiIcon />
          </button>
          {isPickerOpen && <EmojiPicker onSelect={insertEmoji} />}
        </div>

        <button
          type="submit"
          className={styles['composer__send']}
          disabled={!canSubmit}
          aria-label={isEditing ? 'Сохранить изменения' : 'Отправить сообщение'}
        >
          {isEditing ? <CheckIcon /> : <SendIcon />}
        </button>
      </form>
    </div>
  );
}
