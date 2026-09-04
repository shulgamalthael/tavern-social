'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import { cn } from '@/shared/lib/cn';
import { formatFileSize } from '@/shared/lib/format-file-size';
import { Button } from '@/shared/ui/Button';
import { AttachmentIcon, CloseIcon, FileIcon, ForwardIcon, SparkleIcon } from '@/shared/ui/icons';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { confirmToolCall } from '../api/confirm-tool-call';
import { rejectToolCall } from '../api/reject-tool-call';
import { streamAiChat } from '../api/stream-ai-chat';
import { uploadAiChatAttachment } from '../api/upload-ai-chat-attachment';
import { riskLevelLabel, toolLabel } from '../lib/tool-labels';
import type {
  AiChatMessage,
  ChatAttachment,
  PendingConfirmation,
  ToolExecutionSummary,
} from '../model/types';
import styles from './AiChatPanel.module.scss';

/** То же ограничение, что и на backend (`MAX_IMAGE_BYTES` в
 * `common/lib/upload.ts`) — проверка здесь только ради быстрой обратной
 * связи до сетевого запроса, backend всё равно перепроверяет сам как
 * последний рубеж (тот же приём, что `features/send-message/ui/
 * MessageComposer.tsx`, которому это уже понадобилось для человеческого
 * мессенджера — тут переиспользован тот же лимит и тот же UX). */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

export interface AiChatPanelProps {
  businessId: string;
  className?: string;
  /** Открыта ли сейчас плавающая обёртка вокруг этой панели
   * (`WebsiteBuilderWidget.tsx`) — сам компонент остаётся смонтированным
   * постоянно (обёртка скрывает его через CSS, не размонтирует, см. её
   * комментарий про `.aiWindow--hidden`), это поле нужно только чтобы
   * навести фокус на поле ввода КАЖДЫЙ раз при открытии, не только при
   * первом монтировании. */
  isOpen: boolean;
  /** Зовётся СРАЗУ после каждого `tool_result`, где инструмент реально
   * что-то поменял на сайте (`status: 'success'` и `riskLevel !== 'low'` —
   * то есть не `get_project_tree`) — не одним блоком в конце хода (AI-3,
   * "live-canvas apply-on-tool-result"): если ход состоит из нескольких
   * мутирующих инструментов подряд (см. §8 роадмапа, `add_block` × 2 в один
   * ход), холст обновляется после КАЖДОГО, а не только после последнего.
   * Сама панель не умеет перечитать документ билдера: только родитель
   * (`WebsiteBuilderWidget`) знает, есть ли несохранённые локальные правки в
   * сторе, которые нельзя молча затереть. Возвращает `false`, если
   * обновление холста было пропущено именно по этой причине — панель тогда
   * явно предупреждает об этом в истории диалога (один раз за ход, не на
   * каждый пропущенный инструмент), а не молчит о том, что канвас мог не
   * обновиться. */
  onMutationApplied?: () => boolean | Promise<boolean>;
}

/** `AiChatStreamError` уже несёт человекочитаемое сообщение (backend'ская
 * `BackendError`-подобная обработка сделана внутри `stream-ai-chat.ts`/
 * `app/api/ai-chat/route.ts`, оба серверные модули) — этому клиентскому
 * компоненту достаточно просто прочитать `.message`. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Не удалось отправить сообщение — попробуйте ещё раз';
}

/**
 * Мини-чат с AI-ассистентом платформы (AI_PLATFORM_ROADMAP.md, фаза AI-2 —
 * инструменты и первая версия панели, фаза AI-3 — стриминг). Сообщение шлётся
 * через `streamAiChat` (SSE, `POST /businesses/:businessId/ai/chat/stream`),
 * события хода (начало/результат вызова инструмента, финальный текст)
 * применяются к истории по мере прихода, а не одним блоком в конце — тул-
 * баджи и текст ответа появляются в реальном времени, пока ход ещё идёт.
 *
 * Локальный `useState`, не Zustand-стор — история диалога нужна только
 * этой одной панели, ни один другой widget/feature её не читает (см.
 * `frontend/AGENTS.md`, раздел 4, «Store — только для состояния, реально
 * общего для нескольких независимых widgets/features»). Диалог живёт, пока
 * смонтирован билдер — закрытие/открытие плавающего окна (`isOpen`) не
 * размонтирует этот компонент (обёртка в `WebsiteBuilderWidget.tsx` только
 * скрывает его через CSS), поэтому история переживает закрытие чата, но
 * перезагрузка страницы её сбрасывает — персистентная история диалогов не
 * в скоупе этой фазы.
 */
export function AiChatPanel({
  businessId,
  className,
  isOpen,
  onMutationApplied,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setSending] = useState(false);
  /** Имя инструмента, который сейчас выполняется на backend (между
   * `tool_start` и своим `tool_result`) — только для лейбла в пузыре
   * ассистента, который ещё формируется (см. `isStreamingPlaceholder` в
   * рендере). `null`, пока инструмент не запущен (изначальные три точки)
   * или между инструментами. */
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  /** Уже загруженные (не только выбранные) вложения текущего, ещё не
   * отправленного сообщения — загрузка стартует сразу по выбору/вставке
   * файла (см. `attachFile` ниже), не откладывается до клика «Отправить»:
   * так пользователь сразу видит превью или ошибку размера/типа, не ждёт
   * этого одновременно с самим ответом ассистента. */
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isUploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingTool]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  /** Общий путь и для кнопки-скрепки, и для вставки картинки из буфера
   * (`onPaste` ниже) — оба в конечном счёте просто получают `File` и грузят
   * его тем же способом, дублировать логику загрузки под два источника
   * незачем. */
  async function attachFile(file: File) {
    if (pendingAttachments.length >= MAX_ATTACHMENTS) {
      setAttachmentError(`Не больше ${MAX_ATTACHMENTS} вложений за раз`);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(`Файл «${file.name}» больше 5 МБ`);
      return;
    }

    setAttachmentError(null);
    setUploadingAttachment(true);
    try {
      const attachment = await uploadAiChatAttachment(businessId, file);
      setPendingAttachments((prev) => [...prev, attachment]);
    } catch (error) {
      setAttachmentError(errorMessage(error));
    } finally {
      setUploadingAttachment(false);
    }
  }

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = '';
    chosen.forEach((file) => void attachFile(file));
  }

  /** Вставка картинки из буфера прямо в поле ввода — тот же путь, что и
   * кнопка-скрепка (`attachFile`), просто источник `File` другой
   * (`item.getAsFile()` вместо `<input type=file>`). `preventDefault()`
   * только когда в буфере реально есть картинка — иначе обычная вставка
   * текста продолжает работать как раньше. */
  function onInputPaste(event: ClipboardEvent<HTMLInputElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith('image/'),
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    void attachFile(file);
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && pendingAttachments.length === 0) || isSending || isUploadingAttachment) return;

    // Backend требует непустой `message` (`ChatRequestDto`) даже когда суть
    // хода — просто картинка без подписи — плейсхолдер, а не запрет
    // отправлять вложение без текста.
    const text = trimmed || '[Вложение]';
    const attachments = pendingAttachments;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
    ]);
    setInput('');
    setPendingAttachments([]);
    setSending(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', toolExecutions: [] },
    ]);

    const toolExecutions: ToolExecutionSummary[] = [];
    let receivedMessage = false;
    // "Не применено — есть несохранённые правки" — одна и та же причина на
    // весь ход, даже если мутирующих инструментов было несколько подряд
    // (см. §8 роадмапа: `get_project_tree` → `add_block` × 2 в один ход) —
    // предупреждать про неё на каждый инструмент было бы просто шумом.
    let warnedAboutDirty = false;

    try {
      for await (const streamEvent of streamAiChat(
        businessId,
        text,
        attachments.map((attachment) => attachment.id),
      )) {
        if (streamEvent.type === 'tool_start') {
          setPendingTool(streamEvent.tool);
        } else if (streamEvent.type === 'tool_result') {
          setPendingTool(null);
          toolExecutions.push({
            tool: streamEvent.tool,
            riskLevel: streamEvent.riskLevel,
            status: streamEvent.status,
          });
          const executionsSoFar = [...toolExecutions];
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, toolExecutions: executionsSoFar }
                : message,
            ),
          );

          // Применяем мутацию к холсту СРАЗУ по мере готовности каждого
          // инструмента (AI-3, "live-canvas apply-on-tool-result", не
          // одним блоком в конце хода, как раньше) — `await` внутри `for
          // await` тела гарантированно сериализует эти вызовы: следующий
          // эвент из потока не читается, пока текущий `onMutationApplied`
          // не завершится, так что параллельных гонок за перезагрузку
          // документа стора быть не может.
          const mutated = streamEvent.status === 'success' && streamEvent.riskLevel !== 'low';
          if (mutated && onMutationApplied) {
            const applied = await onMutationApplied();
            if (!applied && !warnedAboutDirty) {
              warnedAboutDirty = true;
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content:
                    'Изменения сохранены на сервере, но в конструкторе есть несохранённые правки — сохраните их или обновите страницу, чтобы увидеть результат на холсте.',
                },
              ]);
            }
          }
        } else if (streamEvent.type === 'message') {
          receivedMessage = true;
          setPendingTool(null);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: streamEvent.message } : message,
            ),
          );
        } else if (streamEvent.type === 'confirm_required') {
          // AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — ход диалога закончился
          // здесь: backend не пришлёт отдельный `message`-эвент вдогонку (см.
          // `runToolLoop`'s комментарий), поэтому `receivedMessage` тоже
          // помечаем true — иначе ниже сработал бы фолбэк "соединение
          // прервалось раньше, чем пришёл ответ", хотя всё в порядке.
          receivedMessage = true;
          setPendingTool(null);
          const pendingConfirmation: PendingConfirmation = {
            tool: streamEvent.tool,
            riskLevel: streamEvent.riskLevel,
            confirmationId: streamEvent.confirmationId,
            resolution: 'awaiting',
          };
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, pendingConfirmation } : message,
            ),
          );
        }
      }

      if (!receivedMessage) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: 'Соединение прервалось раньше, чем пришёл ответ.',
                  isError: true,
                }
              : message,
          ),
        );
      }
    } catch (error) {
      setPendingTool(null);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: errorMessage(error), isError: true }
            : message,
        ),
      );
    } finally {
      setPendingTool(null);
      setSending(false);
    }
  }

  function updatePendingConfirmation(messageId: string, patch: Partial<PendingConfirmation>) {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId && message.pendingConfirmation
          ? { ...message, pendingConfirmation: { ...message.pendingConfirmation, ...patch } }
          : message,
      ),
    );
  }

  /** AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — выполняет РОВНО тот вызов,
   * что модель оставила `pending` (`confirmToolCall`, без нового обращения
   * к LLM). Успешное выполнение мутирующего инструмента обновляет холст тем
   * же путём, что и обычный `tool_result` в `handleSubmit` выше. */
  async function handleConfirm(message: AiChatMessage) {
    const pending = message.pendingConfirmation;
    if (!pending || pending.resolution !== 'awaiting') return;

    updatePendingConfirmation(message.id, { resolution: 'confirming' });
    try {
      const result = await confirmToolCall(businessId, pending.confirmationId);
      updatePendingConfirmation(message.id, {
        resolution: result.status === 'success' ? 'confirmed' : 'confirm_failed',
      });
      if (result.status === 'success' && result.riskLevel !== 'low' && onMutationApplied) {
        await onMutationApplied();
      }
    } catch {
      // Сеть упала, или подтверждение уже было обработано где-то ещё
      // (двойной клик, вторая вкладка) — в обоих случаях безопасно НЕ
      // предлагать повторное подтверждение: тот же `confirmationId` либо
      // уже выполнился, либо действительно недоступен, повторный вызов
      // `confirmToolCall` получил бы `404`, не второй реальный запуск.
      updatePendingConfirmation(message.id, { resolution: 'confirm_failed' });
    }
  }

  async function handleReject(message: AiChatMessage) {
    const pending = message.pendingConfirmation;
    if (!pending || pending.resolution !== 'awaiting') return;

    updatePendingConfirmation(message.id, { resolution: 'rejecting' });
    try {
      await rejectToolCall(businessId, pending.confirmationId);
      updatePendingConfirmation(message.id, { resolution: 'rejected' });
    } catch {
      updatePendingConfirmation(message.id, { resolution: 'confirm_failed' });
    }
  }

  return (
    <div className={cn(styles.panel, className)}>
      <ScrollArea
        className={styles.history}
        viewportClassName={styles.history__viewport}
        viewportRef={viewportRef}
      >
        {messages.length === 0 && (
          <div className={styles.empty}>
            <SparkleIcon className={styles.empty__icon} />
            <p className={styles.empty__text}>
              Спросите ассистента о сайте или попросите отредактировать его — например, «добавь на
              главную страницу заголовок и текст» или «узнай, сколько на сайте страниц».
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          // Пузырь ассистента, который сейчас формируется потоком (пустой
          // текст, ещё не пришёл `message`-эвент) — последний в списке, пока
          // `isSending` — показывает точки/текущий инструмент вместо пустого
          // содержимого; `toolExecutions`-баджи под ним рендерятся как обычно
          // и наполняются по мере прихода `tool_result`.
          const isStreamingPlaceholder =
            isSending &&
            index === messages.length - 1 &&
            message.role === 'assistant' &&
            message.content === '' &&
            !message.isError;

          return (
            <div
              key={message.id}
              className={cn(
                styles.message,
                styles[`message--${message.role}`],
                message.isError && styles['message--error'],
              )}
            >
              {message.attachments && message.attachments.length > 0 && (
                <ul className={styles.attachments}>
                  {message.attachments.map((attachment) => (
                    <li key={attachment.id} className={styles.attachment}>
                      {attachment.mimeType.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element -- превью уже загруженного вложения чата, не контентная картинка сайта
                        <img src={attachment.url} alt="" className={styles.attachment__thumb} />
                      ) : (
                        <FileIcon className={styles.attachment__icon} />
                      )}
                      <span className={styles.attachment__name}>{attachment.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {isStreamingPlaceholder ? (
                <div className={cn(styles.message__bubble, styles['message__bubble--pending'])}>
                  {pendingTool ? (
                    <span>{toolLabel(pendingTool)}…</span>
                  ) : (
                    <>
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                    </>
                  )}
                </div>
              ) : (
                <div className={styles.message__bubble}>{message.content}</div>
              )}
              {message.toolExecutions && message.toolExecutions.length > 0 && (
                <ul className={styles.message__tools}>
                  {message.toolExecutions.map((execution, executionIndex) => (
                    <li
                      key={`${execution.tool}-${executionIndex}`}
                      className={cn(
                        styles.toolBadge,
                        execution.status === 'error' && styles['toolBadge--error'],
                      )}
                    >
                      {toolLabel(execution.tool)}
                      {execution.status === 'error' && ' — не удалось'}
                    </li>
                  ))}
                </ul>
              )}
              {message.pendingConfirmation && (
                <div className={styles.confirmCard}>
                  <p className={styles.confirmCard__text}>
                    {toolLabel(message.pendingConfirmation.tool)} —{' '}
                    {riskLevelLabel(message.pendingConfirmation.riskLevel)}, требуется подтверждение
                  </p>
                  {message.pendingConfirmation.resolution === 'awaiting' && (
                    <div className={styles.confirmCard__actions}>
                      <button
                        type="button"
                        className={styles.confirmCard__reject}
                        onClick={() => void handleReject(message)}
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        className={styles.confirmCard__confirm}
                        onClick={() => void handleConfirm(message)}
                      >
                        Подтвердить
                      </button>
                    </div>
                  )}
                  {message.pendingConfirmation.resolution === 'confirming' && (
                    <p className={styles.confirmCard__status}>Выполняем…</p>
                  )}
                  {message.pendingConfirmation.resolution === 'rejecting' && (
                    <p className={styles.confirmCard__status}>Отклоняем…</p>
                  )}
                  {message.pendingConfirmation.resolution === 'confirmed' && (
                    <p className={styles.confirmCard__status}>Выполнено</p>
                  )}
                  {message.pendingConfirmation.resolution === 'rejected' && (
                    <p className={styles.confirmCard__status}>Отклонено</p>
                  )}
                  {message.pendingConfirmation.resolution === 'confirm_failed' && (
                    <p
                      className={cn(
                        styles.confirmCard__status,
                        styles['confirmCard__status--error'],
                      )}
                    >
                      Не удалось выполнить
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>

      {attachmentError && <p className={styles.attachmentError}>{attachmentError}</p>}

      {pendingAttachments.length > 0 && (
        <ul className={styles.composerAttachments}>
          {pendingAttachments.map((attachment) => (
            <li key={attachment.id} className={styles.composerAttachment}>
              {attachment.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element -- превью только что загруженного вложения до отправки
                <img src={attachment.url} alt="" className={styles.composerAttachment__thumb} />
              ) : (
                <FileIcon className={styles.composerAttachment__icon} />
              )}
              <span className={styles.composerAttachment__name}>{attachment.name}</span>
              <span className={styles.composerAttachment__size}>
                {formatFileSize(attachment.sizeBytes)}
              </span>
              <button
                type="button"
                className={styles.composerAttachment__remove}
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`Убрать вложение ${attachment.name}`}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <button
          type="button"
          className={styles.attachButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={
            isSending || isUploadingAttachment || pendingAttachments.length >= MAX_ATTACHMENTS
          }
          aria-label="Прикрепить файл"
        >
          <AttachmentIcon />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className={styles.fileInput}
          onChange={onFilesChosen}
          tabIndex={-1}
        />

        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onPaste={onInputPaste}
          placeholder="Напишите ассистенту…"
          disabled={isSending}
          aria-label="Сообщение AI-ассистенту"
        />
        <Button
          type="submit"
          disabled={isSending || (input.trim().length === 0 && pendingAttachments.length === 0)}
          aria-label="Отправить"
        >
          <ForwardIcon />
        </Button>
      </form>
    </div>
  );
}
