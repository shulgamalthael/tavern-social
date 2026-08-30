'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { ForwardIcon, SparkleIcon } from '@/shared/ui/icons';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { streamAiOnboarding } from '../api/stream-ai-onboarding';
import type { AiOnboardingMessage } from '../model/types';
import styles from './AiOnboardingChat.module.scss';

export interface AiOnboardingChatProps {
  className?: string;
  /** Зовётся сразу по приходу `business_created` (ещё до финального текстового
   * ответа модели, см. `AiOnboardingService.runToolLoop` на backend — эвент
   * "бизнес создан" уходит раньше follow-up-запроса за текстом) — родитель
   * (`NewBusinessFlow`) переходит в конструктор сразу, тем же путём, что и
   * ручная форма после успешного `createBusiness()`. `templateId` — какой
   * стартовый набор блоков выбрала модель ("blank", если не подошёл ни один,
   * см. `create_business`'s описание на backend) — родитель прокидывает его
   * дальше в URL редиректа. */
  onBusinessCreated: (businessId: string, templateId: string) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Не удалось отправить сообщение — попробуйте ещё раз';
}

/**
 * Диалоговый онбординг создания бизнеса (AI-4, AI_PLATFORM_ROADMAP.md §2.7)
 * — тот же стриминговый паттерн, что и `features/ai-chat/ui/AiChatPanel.tsx`
 * (SSE через `streamAiOnboarding`, пузыри истории заполняются по мере
 * прихода эвентов), но без тул-баджей: здесь ровно один инструмент
 * (`create_business`), и его результат — не список бэйджей под пузырём, а
 * переход в конструктор (`onBusinessCreated`).
 */
export function AiOnboardingChat({ className, onBusinessCreated }: AiOnboardingChatProps) {
  const [messages, setMessages] = useState<AiOnboardingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setSending] = useState(false);
  const [isRedirecting, setRedirecting] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setInput('');
    setSending(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let receivedMessage = false;
    let createdBusinessId: string | null = null;
    let createdTemplateId = 'blank';

    try {
      for await (const streamEvent of streamAiOnboarding(text)) {
        if (streamEvent.type === 'business_created') {
          createdBusinessId = streamEvent.businessId;
          createdTemplateId = streamEvent.templateId;
        } else if (streamEvent.type === 'message') {
          receivedMessage = true;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: streamEvent.message } : message,
            ),
          );
        }
      }

      if (createdBusinessId) {
        setRedirecting(true);
        onBusinessCreated(createdBusinessId, createdTemplateId);
        return;
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
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: errorMessage(error), isError: true }
            : message,
        ),
      );
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
              Расскажите, какой бизнес хотите открыть — например, «обменник криптовалют на
              Крещатике» или «студия маникюра». Спросим название и категорию и сразу создадим
              сайт-заготовку.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
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
              {isStreamingPlaceholder ? (
                <div className={cn(styles.message__bubble, styles['message__bubble--pending'])}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              ) : (
                <div className={styles.message__bubble}>{message.content}</div>
              )}
            </div>
          );
        })}

        {isRedirecting && (
          <div className={cn(styles.message, styles['message--assistant'])}>
            <div className={cn(styles.message__bubble, styles['message__bubble--pending'])}>
              <span>Открываем конструктор…</span>
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
          placeholder="Например, «Открываю обменник криптовалют»…"
          disabled={isSending || isRedirecting}
          aria-label="Сообщение AI-ассистенту"
        />
        <Button
          type="submit"
          disabled={isSending || isRedirecting || input.trim().length === 0}
          aria-label="Отправить"
        >
          <ForwardIcon />
        </Button>
      </form>
    </div>
  );
}
