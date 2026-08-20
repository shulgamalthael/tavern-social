'use client';

import { useEffect, useRef, useState } from 'react';
import { type ChatMessage, useThreadStore } from '@/entities/thread';
import { useCurrentUser } from '@/entities/user';
import { useNavigationStore } from '@/features/section-navigation';
import { MessageComposer } from '@/features/send-message';
import { cn } from '@/shared/lib/cn';
import { formatDayLabel } from '@/shared/lib/format-day-label';
import { formatMessageTime } from '@/shared/lib/format-message-time';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { AddPersonIcon, BackIcon } from '@/shared/ui/icons';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { AddParticipantDropdown } from './AddParticipantDropdown';
import { MessageBubble } from './MessageBubble';
import styles from './MessengerWidget.module.scss';

type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'cluster'; key: string; mine: boolean; messages: ChatMessage[] };

/** Разбивает плоский список сообщений на разделители дня и цепочки подряд
 * идущих сообщений одного отправителя — как в Telegram: сообщения одного
 * автора без ответа между ними визуально «слипаются» в одну группу. */
function buildChatRows(messages: ChatMessage[]): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDayLabel: string | null = null;
  let lastCluster: Extract<ChatRow, { kind: 'cluster' }> | null = null;

  for (const message of messages) {
    const dayLabel = formatDayLabel(message.createdAt);
    if (dayLabel !== lastDayLabel) {
      rows.push({ kind: 'day', key: `day:${message.id}`, label: dayLabel });
      lastDayLabel = dayLabel;
      lastCluster = null;
    }

    if (lastCluster && lastCluster.mine === message.mine) {
      lastCluster.messages.push(message);
    } else {
      lastCluster = {
        kind: 'cluster',
        key: `cluster:${message.id}`,
        mine: message.mine,
        messages: [message],
      };
      rows.push(lastCluster);
    }
  }

  return rows;
}

export function MessengerWidget() {
  const threads = useThreadStore((state) => state.threads);
  const status = useThreadStore((state) => state.status);
  const error = useThreadStore((state) => state.error);
  const loadThreads = useThreadStore((state) => state.loadThreads);
  const activeThreadId = useThreadStore((state) => state.activeThreadId);
  const setActiveThread = useThreadStore((state) => state.setActiveThread);
  const addParticipant = useThreadStore((state) => state.addParticipant);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const { currentUser } = useCurrentUser();
  const [isChatOpen, setChatOpen] = useState(false);
  const [isAddParticipantOpen, setAddParticipantOpen] = useState(false);

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const lastScrolledThreadId = useRef<string | null>(null);
  const addParticipantContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Виджет размонтируется при уходе в другой раздел (`ActiveSection` в
    // `app/home-app.tsx` меняется целиком) — если не сбросить активный тред
    // здесь, `receiveMessage` продолжит считать его «открытым» и молча
    // помечать новые сообщения прочитанными, даже когда мессенджер не
    // смонтирован вообще (счётчик непрочитанных не растёт, хотя пользователь
    // ничего не видел).
    return () => setActiveThread(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = chatBodyRef.current;
    if (!container || !activeThread) return;

    // Открыли другой диалог — прыгаем к последнему сообщению мгновенно;
    // новое сообщение в уже открытом (отправленное или полученное живьём
    // через сокет — оба пути меняют `messages.length`) — плавно.
    const isThreadSwitch = lastScrolledThreadId.current !== activeThread.id;
    lastScrolledThreadId.current = activeThread.id;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: isThreadSwitch ? 'auto' : 'smooth',
    });
    // Намеренно только id и число сообщений — сам объект `activeThread`
    // (и, значит, весь `threads`) меняет ссылку при любом обновлении стора
    // (например, «не в зале сейчас» → «в зале»), что вызывало бы лишний
    // скролл без нового сообщения.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, activeThread?.messages.length]);

  useEffect(() => {
    if (!isAddParticipantOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!addParticipantContainerRef.current?.contains(event.target as Node)) {
        setAddParticipantOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isAddParticipantOpen]);

  const openThread = (threadId: string) => {
    setActiveThread(threadId);
    setChatOpen(true);
    setAddParticipantOpen(false);
  };

  const closeChat = () => {
    setChatOpen(false);
    setAddParticipantOpen(false);
    // На мобильном «Назад» возвращает к списку, но тред формально остаётся
    // «просматриваемым» — тот же сброс, что и при уходе из раздела: иначе
    // новые сообщения в нём молча помечаются прочитанными за спиной списка.
    setActiveThread(null);
  };

  return (
    <main className={styles['messenger-page']}>
      {status === 'loading' && (
        <div className={styles['messenger-page__status']}>
          <Loader label="Загружаем диалоги…" />
        </div>
      )}

      {status === 'error' && (
        <div className={styles['messenger-page__status']}>
          <ErrorState message={error} onRetry={loadThreads} />
        </div>
      )}

      {status === 'success' && threads.length === 0 && (
        <div className={styles['messenger-page__status']}>
          <EmptyState
            title="Пока нет сообщений"
            description="Как только у вас появятся друзья, здесь будут ваши разговоры с ними."
            action={
              <Button variant="outline" onClick={() => goToSection('friends')}>
                Перейти к друзьям
              </Button>
            }
          />
        </div>
      )}

      {status === 'success' && threads.length > 0 && (
        <div className={styles.messenger} data-chat-open={isChatOpen}>
          <ScrollArea
            className={styles['messenger__thread-list']}
            viewportClassName={styles['messenger__thread-list-viewport']}
          >
            {threads.map((thread) => {
              const lastMessage = thread.messages[thread.messages.length - 1];
              return (
                <button
                  key={thread.id}
                  type="button"
                  className={cn(
                    styles['messenger__thread-item'],
                    thread.id === activeThreadId && styles['messenger__thread-item--active'],
                  )}
                  onClick={() => openThread(thread.id)}
                >
                  <Avatar initials={thread.initials} size="sm" />
                  <span className={styles['messenger__thread-body']}>
                    <span className={styles['messenger__thread-name']}>{thread.name}</span>
                    <span className={styles['messenger__thread-preview']}>{lastMessage?.text}</span>
                  </span>
                  <span className={styles['messenger__thread-meta']}>
                    {lastMessage && (
                      <span className={styles['messenger__thread-time']}>
                        {formatMessageTime(lastMessage.createdAt)}
                      </span>
                    )}
                    {thread.unread ? <Badge variant="soft">{thread.unread}</Badge> : null}
                  </span>
                </button>
              );
            })}
          </ScrollArea>

          <div className={styles['messenger__chat']}>
            {activeThread ? (
              <>
                <header className={styles['messenger__chat-head']}>
                  <button
                    type="button"
                    className={styles['messenger__back-button']}
                    onClick={closeChat}
                    aria-label="Назад к списку"
                  >
                    <BackIcon />
                  </button>
                  <Avatar initials={activeThread.initials} size="sm" />
                  <span className={styles['messenger__chat-head-body']}>
                    <span className={styles['messenger__thread-name']}>{activeThread.name}</span>
                    <span className={styles['messenger__status']}>{activeThread.status}</span>
                  </span>
                  <div
                    className={styles['messenger__add-participant']}
                    ref={addParticipantContainerRef}
                  >
                    <button
                      type="button"
                      className={styles['messenger__add-participant-button']}
                      aria-label="Добавить собеседника"
                      aria-expanded={isAddParticipantOpen}
                      onClick={() => setAddParticipantOpen((open) => !open)}
                    >
                      <AddPersonIcon />
                    </button>
                    {isAddParticipantOpen && (
                      <AddParticipantDropdown
                        excludeUserIds={[
                          currentUser.id,
                          ...activeThread.participants.map((participant) => participant.id),
                        ]}
                        isDirectThread={!activeThread.isGroup}
                        onAdd={(userId) => addParticipant(activeThread.id, userId)}
                        onClose={() => setAddParticipantOpen(false)}
                      />
                    )}
                  </div>
                </header>

                <ScrollArea
                  className={styles['messenger__chat-body']}
                  viewportClassName={styles['messenger__chat-body-viewport']}
                  viewportRef={chatBodyRef}
                >
                  {buildChatRows(activeThread.messages).map((row) =>
                    row.kind === 'day' ? (
                      <div key={row.key} className={styles['messenger__day-divider']}>
                        <span>{row.label}</span>
                      </div>
                    ) : (
                      <div
                        key={row.key}
                        className={cn(
                          styles['messenger__cluster'],
                          row.mine && styles['messenger__cluster--mine'],
                        )}
                      >
                        {row.messages.map((message, index) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            position={{
                              isFirstInCluster: index === 0,
                              isLastInCluster: index === row.messages.length - 1,
                            }}
                          />
                        ))}
                      </div>
                    ),
                  )}
                </ScrollArea>

                <MessageComposer threadId={activeThread.id} />
              </>
            ) : (
              <EmptyState
                className={styles['messenger__placeholder']}
                title="Выберите диалог"
                description="Список слева — откройте разговор, чтобы увидеть сообщения."
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
