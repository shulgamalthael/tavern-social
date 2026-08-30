'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { ForwardIcon, SparkleIcon } from '@/shared/ui/icons';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { sendAiChatMessage } from '../api/send-ai-chat-message';
import type { AiChatMessage } from '../model/types';
import styles from './AiChatPanel.module.scss';

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
  /** Зовётся после ответа, где хотя бы один инструмент реально что-то
   * поменял на сайте (`status: 'success'` и `riskLevel !== 'low'` — то есть
   * не `get_project_tree`). Сама панель не умеет перечитать документ
   * билдера: только родитель (`WebsiteBuilderWidget`) знает, есть ли
   * несохранённые локальные правки в сторе, которые нельзя молча
   * затереть. Возвращает `false`, если обновление холста было пропущено
   * именно по этой причине — панель тогда явно предупреждает об этом в
   * истории диалога, а не молчит о том, что канвас мог не обновиться. */
  onMutationApplied?: () => boolean | Promise<boolean>;
}

const TOOL_LABELS: Record<string, string> = {
  get_project_tree: 'Прочитал структуру сайта',
  create_page: 'Создал страницу',
  add_block: 'Добавил блок',
  update_block_props: 'Изменил блок',
  set_style: 'Изменил оформление блока',
};

function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

/** `sendAiChatMessage` уже разворачивает `BackendError` (в т.ч. «AI не
 * настроен», 503) в обычный `Error` НА СЕРВЕРЕ — этот компонент клиентский
 * и не может импортировать `backend-client.ts` вообще (см. её комментарий:
 * `server-only`, `next build` падает на попытке). */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Не удалось отправить сообщение — попробуйте ещё раз';
}

/**
 * Мини-чат с AI-ассистентом платформы (AI_PLATFORM_ROADMAP.md, фаза AI-2,
 * последний оставшийся кусок фазы после четырёх backend-инструментов —
 * `get_project_tree`/`create_page`/`add_block`/`set_style`/
 * `update_block_props`). Без стриминга (AI-3) — один запрос-ответ на
 * сообщение, тот же `POST /ai/chat`, что уже curl-верифицирован в §6-§8
 * роадмапа.
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const result = await sendAiChatMessage(businessId, text);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.message,
          toolExecutions: result.toolExecutions,
        },
      ]);
      const didMutate = result.toolExecutions.some(
        (execution) => execution.status === 'success' && execution.riskLevel !== 'low',
      );
      if (didMutate && onMutationApplied) {
        const applied = await onMutationApplied();
        if (!applied) {
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
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorMessage(error),
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
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

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              styles.message,
              styles[`message--${message.role}`],
              message.isError && styles['message--error'],
            )}
          >
            <div className={styles.message__bubble}>{message.content}</div>
            {message.toolExecutions && message.toolExecutions.length > 0 && (
              <ul className={styles.message__tools}>
                {message.toolExecutions.map((execution, index) => (
                  <li
                    key={`${execution.tool}-${index}`}
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
          </div>
        ))}

        {isSending && (
          <div className={cn(styles.message, styles['message--assistant'])}>
            <div className={cn(styles.message__bubble, styles['message__bubble--pending'])}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}
      </ScrollArea>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Напишите ассистенту…"
          disabled={isSending}
          aria-label="Сообщение AI-ассистенту"
        />
        <Button
          type="submit"
          disabled={isSending || input.trim().length === 0}
          aria-label="Отправить"
        >
          <ForwardIcon />
        </Button>
      </form>
    </div>
  );
}
