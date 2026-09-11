'use client';

import { useEffect, useRef, useState } from 'react';
import { type ChatMessage, type ThreadParticipant, useThreadStore } from '@/entities/thread';
import { useCurrentUser } from '@/entities/user';
import { useNavigationStore } from '@/features/section-navigation';
import { MessageComposer } from '@/features/send-message';
import { ThreadSearchBar } from '@/features/search-messages';
import { cn } from '@/shared/lib/cn';
import { formatDayLabel } from '@/shared/lib/format-day-label';
import { formatMessageTime } from '@/shared/lib/format-message-time';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import {
  AddPersonIcon,
  BackIcon,
  ChevronDownIcon,
  MessagesIcon,
  PinIcon,
  SearchIcon,
} from '@/shared/ui/icons';
import { Modal } from '@/shared/ui/Modal';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { Skeleton } from '@/shared/ui/Skeleton';
import { AddParticipantDropdown } from './AddParticipantDropdown';
import { ForwardMessageModal } from './ForwardMessageModal';
import { MessageBubble } from './MessageBubble';
import { MessengerSearchModal } from './MessengerSearchModal';
import styles from './MessengerWidget.module.scss';

/** Превью последнего сообщения в списке диалогов — раньше при вложении без
 * текста строка оставалась пустой (просто не было `lastMessage.text`),
 * теперь честно показывает, что там фото/файл, а не тишина. */
function threadPreviewText(message: ChatMessage | undefined): string {
  if (!message) return '';
  if (message.text) return message.text;
  const hasImage = message.attachments.some((attachment) =>
    attachment.mimeType.startsWith('image/'),
  );
  if (hasImage) return '📷 Фото';
  if (message.attachments.length > 0) return '📎 Файл';
  return '';
}

/** Точка «в зале» на аватаре собеседника в списке диалогов/шапке чата —
 * только для 1:1 (у группы нет единого собеседника, см. `thread.isGroup`).
 * `Thread.status` — уже готовая для показа строка с backend
 * (`ThreadsService.toDto`: `'здесь'` при `presenceService.isOnline`, иначе
 * `'не в зале сейчас'`, у группы вообще другой текст — число участников), а
 * не отдельный булев флаг: заводить под один-единственный индикатор ещё одно
 * поле в DTO/сокет-пейлоуде было бы дублированием того же присутствия, что
 * уже видно из текста статуса под именем. */
function isOnlineStatus(status: string): boolean {
  return status === 'здесь';
}

/** Сколько держится подсветка «сюда прыгнули» после скролла — достаточно,
 * чтобы заметить, но не настолько долго, чтобы выглядело зависшим. */
const MESSAGE_HIGHLIGHT_MS = 1500;

/** Порог «читаем конец переписки» для автоскролла к новым сообщениям (см.
 * ниже, эффект на `activeThread.messages.length`) — небольшой запас, а не
 * ровно 0px: инерционная прокрутка тачпадом/колесом может оставить
 * `scrollTop` на пару пикселей выше реального дна, что не должно считаться
 * «пролистал историю». */
const NEAR_BOTTOM_THRESHOLD_PX = 80;

/** Скроллит к сообщению по стабильному `id` бабла (см. `MessageBubble.tsx`,
 * `message-${id}`) — используется закреплёнными сообщениями, поиском (в
 * чате и по всем чатам) и цитатой ответа; ничего не делает, если сообщение
 * не в текущем DOM (не загружено — история сообщений не пагинируется, так
 * что практически недостижимо, но на всякий случай не падает). Помимо
 * скролла, на секунду подсвечивает найденный бабл (`data-highlighted` —
 * обычный HTML-атрибут, а не CSS-модульный класс: функция не привязана к
 * конкретному компоненту-владельцу стиля, стиль подсветки описан в
 * `MessageBubble.module.scss`, `[data-highlighted='true']`) — просто скролл
 * без ориентира на плотной странице легко принять за то, что ничего не
 * произошло, особенно если целевое сообщение и так было видно на экране. */
function scrollToMessage(messageId: string) {
  const element = document.getElementById(`message-${messageId}`);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.setAttribute('data-highlighted', 'true');
  window.setTimeout(() => element.removeAttribute('data-highlighted'), MESSAGE_HIGHLIGHT_MS);
}

const THREADS_SKELETON_COUNT = 7;

/** Заглушка строки диалога на время загрузки списка — только для этого
 * виджета, строка диалога сама по себе не вынесена в отдельный компонент
 * (см. реальную разметку ниже, в `.messenger__thread-item`). */
function ThreadItemSkeleton() {
  return (
    <div className={styles['messenger__thread-item']}>
      <Skeleton width={38} height={38} radius="50%" />
      <span className={styles['messenger__thread-body']}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="80%" height={12.5} />
      </span>
    </div>
  );
}

type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'cluster'; key: string; mine: boolean; senderId: string; messages: ChatMessage[] };

/** Разбивает плоский список сообщений на разделители дня и цепочки подряд
 * идущих сообщений одного отправителя — как в Telegram: сообщения одного
 * автора без ответа между ними визуально «слипаются» в одну группу.
 * Кластеризация по `senderId`, не только по `mine` — в групповом чате все
 * чужие сообщения формально `mine: false`, но у разных собеседников разный
 * `senderId`, и подряд идущие сообщения ДВУХ разных людей не должны
 * слипаться в один кластер под одной подписью. */
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

    if (lastCluster && lastCluster.senderId === message.senderId) {
      lastCluster.messages.push(message);
    } else {
      lastCluster = {
        kind: 'cluster',
        key: `cluster:${message.id}`,
        mine: message.mine,
        senderId: message.senderId,
        messages: [message],
      };
      rows.push(lastCluster);
    }
  }

  return rows;
}

interface ClusterSenderLabelProps {
  participants: ThreadParticipant[];
  senderId: string;
}

/** Аватар + имя над цепочкой чужих сообщений в групповом чате — иначе
 * в группе 3+ человек непонятно, кто из «не я» именно это написал (в
 * личном 1:1-диалоге собеседник один и так виден в шапке чата, здесь эта
 * подпись не нужна — см. вызов ниже, только для `isGroup`). */
function ClusterSenderLabel({ participants, senderId }: ClusterSenderLabelProps) {
  const sender = participants.find((participant) => participant.id === senderId);
  if (!sender) return null;

  return (
    <div className={styles['messenger__cluster-sender']}>
      <Avatar initials={sender.initials} src={sender.avatarUrl} size="sm" />
      <span className={styles['messenger__cluster-sender-name']}>{sender.name}</span>
    </div>
  );
}

export function MessengerWidget() {
  const threads = useThreadStore((state) => state.threads);
  const status = useThreadStore((state) => state.status);
  const error = useThreadStore((state) => state.error);
  const loadThreads = useThreadStore((state) => state.loadThreads);
  const activeThreadId = useThreadStore((state) => state.activeThreadId);
  const draftTarget = useThreadStore((state) => state.draftTarget);
  const setActiveThread = useThreadStore((state) => state.setActiveThread);
  const openDirectThreadWith = useThreadStore((state) => state.openDirectThreadWith);
  const addParticipant = useThreadStore((state) => state.addParticipant);
  const startEditingMessage = useThreadStore((state) => state.startEditingMessage);
  const deleteMessage = useThreadStore((state) => state.deleteMessage);
  const startReplyingToMessage = useThreadStore((state) => state.startReplyingToMessage);
  const forwardMessage = useThreadStore((state) => state.forwardMessage);
  const pinMessage = useThreadStore((state) => state.pinMessage);
  const unpinMessage = useThreadStore((state) => state.unpinMessage);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const { currentUser } = useCurrentUser();
  const [isChatOpen, setChatOpen] = useState(false);
  const [isAddParticipantOpen, setAddParticipantOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<{
    sourceThreadId: string;
    messageId: string;
  } | null>(null);
  const [deletingMessage, setDeletingMessage] = useState<{
    threadId: string;
    messageId: string;
  } | null>(null);
  const [isDeletingPending, setDeletingPending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isThreadSearchOpen, setThreadSearchOpen] = useState(false);
  const [isAllThreadsSearchOpen, setAllThreadsSearchOpen] = useState(false);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  // Какой тред уже отражён в `pinnedIndex` — сбрасываем указатель на первое
  // закреплённое сообщение при переключении диалога, тем же приёмом «adjust
  // state during render», что и `MessageComposer` (см. там же — почему не
  // эффект).
  const [syncedPinnedThreadId, setSyncedPinnedThreadId] = useState<string | null>(null);
  // Плавающая кнопка «к последним сообщениям» — видна, когда прокрутили
  // историю вверх; счётчик — сколько новых сообщений пришло, пока читали
  // (см. эффект на `activeThread.messages.length` и слушатель скролла ниже).
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const lastScrolledThreadId = useRef<string | null>(null);
  const addParticipantContainerRef = useRef<HTMLDivElement>(null);
  // Зеркало `!showScrollButton` в ref — читается синхронно внутри эффекта
  // автоскролла ниже (который реагирует на новые сообщения, не на сам
  // скролл) без необходимости перезапускать его при каждом пикселе
  // прокрутки, если бы `showScrollButton` было у него в зависимостях.
  const isNearBottomRef = useRef(true);

  if (activeThread && activeThread.id !== syncedPinnedThreadId) {
    setSyncedPinnedThreadId(activeThread.id);
    setPinnedIndex(0);
  }

  // Открепили (сами или другой участник по сокету — `thread:pinned-changed`)
  // именно то закреплённое сообщение, на которое сейчас указывает
  // `pinnedIndex`, пока смотрели не на первое — массив укоротился, но
  // индекс остался прежним и стал указывать за его пределы
  // (`pinnedMessages[pinnedIndex] === undefined`). Без этой клэмпинги клик
  // по плашке падал с `TypeError`, а счётчик «N/M» временно показывал
  // индекс больше общего числа. Тот же приём «adjust state during render»,
  // что и сброс при смене треда выше — не эффект, чтобы не мелькать одним
  // лишним кадром со старым индексом перед перерисовкой.
  const pinnedCount = activeThread?.pinnedMessages.length ?? 0;
  if (pinnedCount > 0 && pinnedIndex >= pinnedCount) {
    setPinnedIndex(pinnedCount - 1);
  }

  // Маленькое превью-фото у закреплённого сообщения в плашке — просто
  // ориентир, что там за сообщение, поэтому кроп в квадрат уместен (в
  // отличие от полноразмерной картинки в самом бабле, см. `MessageBubble.
  // module.scss`, где кроп для одной картинки убрали).
  const pinnedImage = activeThread?.pinnedMessages[pinnedIndex]?.attachments.find((attachment) =>
    attachment.mimeType.startsWith('image/'),
  );

  useEffect(() => {
    // Виджет размонтируется при уходе в другой раздел (`ActiveSection` в
    // `app/home-app.tsx` меняется целиком) — если не сбросить активный тред
    // здесь, `receiveMessage` продолжит считать его «открытым» и молча
    // помечать новые сообщения прочитанными, даже когда мессенджер не
    // смонтирован вообще (счётчик непрочитанных не растёт, хотя пользователь
    // ничего не видел).
    return () => {
      // Проверка раздела, а не безусловный сброс: в дев-режиме (React
      // Strict Mode) React намеренно вызывает этот cleanup один раз сразу
      // после первого монтирования, чтобы проверить его идемпотентность —
      // в этот момент раздел ещё остаётся «messages» (реальной навигации
      // не было). Активный тред при этом мог быть выставлен снаружи ещё ДО
      // монтирования виджета (кнопка «Написать» на карточке друга,
      // `openDirectThreadWith`) — безусловный сброс стирал бы его на
      // спровоцированном React'ом холостом цикле. При настоящем уходе из
      // раздела к моменту вызова cleanup `section` уже другой (именно
      // смена раздела и вызвала размонтирование), так что сброс тут
      // происходит только когда мессенджер правда покинули.
      if (useNavigationStore.getState().section !== 'messages') {
        setActiveThread(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const container = chatBodyRef.current;
    if (!container || !activeThread) return;

    // Открыли другой диалог — прыгаем к последнему сообщению мгновенно и
    // сбрасываем плашку «новые сообщения» от предыдущего треда.
    const isThreadSwitch = lastScrolledThreadId.current !== activeThread.id;
    lastScrolledThreadId.current = activeThread.id;

    if (isThreadSwitch) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      isNearBottomRef.current = true;
      setShowScrollButton(false);
      setNewMessageCount(0);
      return;
    }

    // Новое сообщение в уже открытом диалоге. Своё (только что отправленное)
    // всегда подскролливает вниз — иначе не увидеть, что сам только что
    // написал. Чужое (живьём через сокет) — только если и так читали
    // недавние сообщения; если пролистали вверх к истории, принудительный
    // скролл выдернул бы из чтения, поэтому вместо этого просто считаем
    // непоказанные (см. `.messenger__scroll-bottom` ниже).
    const lastMessage = activeThread.messages[activeThread.messages.length - 1];
    const isOwnMessage = Boolean(lastMessage?.mine);
    if (isNearBottomRef.current || isOwnMessage) {
      container.scrollTo({
        top: container.scrollHeight,
        // Уже у дна — короткая дистанция, плавно. Своё сообщение, но
        // пролистали далеко вверх — потенциально вся история треда, тот же
        // случай, что и у ручной кнопки «вниз» (`scrollToBottom` выше):
        // долгая плавная анимация шлёт кучу промежуточных `scroll`-событий,
        // на которых слушатель ниже ещё видит дистанцию больше порога и
        // снова показывает кнопку прямо поверх только что сброшенного
        // состояния — мгновенный прыжок этого окна не оставляет.
        behavior: isNearBottomRef.current ? 'smooth' : 'auto',
      });
      isNearBottomRef.current = true;
      setShowScrollButton(false);
      setNewMessageCount(0);
    } else {
      setNewMessageCount((count) => count + 1);
    }
    // Намеренно только id и число сообщений — сам объект `activeThread`
    // (и, значит, весь `threads`) меняет ссылку при любом обновлении стора
    // (например, «не в зале сейчас» → «в зале»), что вызывало бы лишний
    // скролл без нового сообщения.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, activeThread?.messages.length]);

  // Отслеживает, читаем ли мы сейчас конец истории — влияет на решение выше
  // (подскролливать ли автоматически к новому чужому сообщению) и на
  // видимость плавающей кнопки «вниз». Переустанавливается при смене треда
  // на случай, если сам DOM-узел viewport'а между тредами меняется (переход
  // из плейсхолдера «выберите диалог», где `ScrollArea` не смонтирован, в
  // открытый тред).
  useEffect(() => {
    const container = chatBodyRef.current;
    if (!container) return undefined;

    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const nearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
      isNearBottomRef.current = nearBottom;
      setShowScrollButton(!nearBottom);
      if (nearBottom) setNewMessageCount(0);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [activeThread?.id]);

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
    setThreadSearchOpen(false);
    setShowScrollButton(false);
    setNewMessageCount(0);
  };

  const scrollToBottom = () => {
    const container = chatBodyRef.current;
    if (!container) return;
    // `behavior: 'auto'` (мгновенный прыжок), не `'smooth'` — при большой
    // дистанции (сотни непрочитанных сообщений над экраном) плавная анимация
    // растягивается на сотни миллисекунд и всё это время шлёт промежуточные
    // `scroll`-события; слушатель ниже на каждое из них честно пересчитывает
    // «у дна ли мы» и на подлёте к цели видит дистанцию ещё больше порога
    // (`NEAR_BOTTOM_THRESHOLD_PX`) — `setShowScrollButton(false)` тут же
    // перезатирался обратно в `true`, и кнопка не пропадала по клику.
    // Мгновенный скролл даёт один `scroll`-тик уже у самого дна — без окна,
    // в которое может влезть протух­шее промежуточное состояние.
    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
    setNewMessageCount(0);
  };

  const openThreadAndScrollTo = (threadId: string, messageId: string) => {
    openThread(threadId);
    setAllThreadsSearchOpen(false);
    // Сообщения диалога уже в сторе (весь список грузится один раз при
    // старте, см. `loadThreads`) — переключение треда не ждёт новый REST-
    // запрос, но DOM-узел бабла появляется только после коммита React, чуть
    // позже текущего события клика — `requestAnimationFrame` даёт этому
    // случиться первым.
    requestAnimationFrame(() => scrollToMessage(messageId));
  };

  const openThreadFromSearch = (threadId: string) => {
    openThread(threadId);
    setAllThreadsSearchOpen(false);
  };

  /** Найденный в поиске человек, с которым ещё нет личного диалога — тот же
   * черновик (`draftTarget`), что и у кнопки «Написать» на карточке друга/
   * странице профиля (см. `openDirectThreadWith`), просто ещё один источник
   * вызова. Если диалог с ним всё же уже есть (групповой — `MessengerSearchModal`
   * не показывает в «Людях» тех, у кого есть личный, но групповой не
   * исключён), `openDirectThreadWith` сам найдёт и откроет его вместо
   * создания черновика. */
  const openPersonFromSearch = (person: ThreadParticipant) => {
    openDirectThreadWith(person);
    setChatOpen(true);
    setAllThreadsSearchOpen(false);
  };

  const confirmDeleteMessage = async () => {
    if (!deletingMessage) return;
    setDeletingPending(true);
    setDeleteError(null);
    try {
      await deleteMessage(deletingMessage.threadId, deletingMessage.messageId);
      setDeletingMessage(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Не удалось удалить сообщение');
    } finally {
      setDeletingPending(false);
    }
  };

  const closeChat = () => {
    setChatOpen(false);
    setAddParticipantOpen(false);
    setThreadSearchOpen(false);
    // На мобильном «Назад» возвращает к списку, но тред формально остаётся
    // «просматриваемым» — тот же сброс, что и при уходе из раздела: иначе
    // новые сообщения в нём молча помечаются прочитанными за спиной списка.
    setActiveThread(null);
  };

  return (
    <main className={styles['messenger-page']}>
      {status === 'loading' && (
        <div className={styles.messenger}>
          <div className={styles['messenger__thread-list']}>
            <div className={styles['messenger__thread-list-viewport']}>
              {Array.from({ length: THREADS_SKELETON_COUNT }, (_, index) => (
                <ThreadItemSkeleton key={index} />
              ))}
            </div>
          </div>
          <div className={styles['messenger__chat']} />
        </div>
      )}

      {status === 'error' && (
        <div className={styles['messenger-page__status']}>
          <ErrorState message={error} onRetry={loadThreads} />
        </div>
      )}

      {status === 'success' && threads.length === 0 && !draftTarget && (
        <div className={styles['messenger-page__status']}>
          <EmptyState
            title="Пока нет сообщений"
            description="Напишите кому-нибудь первым — дружба для этого не нужна."
            action={
              <Button variant="outline" onClick={() => goToSection('friends')}>
                Перейти к друзьям
              </Button>
            }
          />
        </div>
      )}

      {status === 'success' && (threads.length > 0 || draftTarget) && (
        <div className={styles.messenger} data-chat-open={isChatOpen}>
          <div className={styles['messenger__thread-panel']}>
            <div className={styles['messenger__thread-list-head']}>
              <span className={styles['messenger__thread-list-title']}>Сообщения</span>
            </div>
            <button
              type="button"
              className={styles['messenger__search-field']}
              onClick={() => setAllThreadsSearchOpen(true)}
            >
              <SearchIcon />
              <span>Поиск по чатам, сообщениям и людям</span>
            </button>
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
                      Boolean(thread.unread) && styles['messenger__thread-item--unread'],
                    )}
                    onClick={() => openThread(thread.id)}
                  >
                    <Avatar
                      initials={thread.initials}
                      src={thread.avatarUrl}
                      size="md"
                      online={!thread.isGroup && isOnlineStatus(thread.status)}
                    />
                    <span className={styles['messenger__thread-body']}>
                      <span className={styles['messenger__thread-name']}>{thread.name}</span>
                      <span className={styles['messenger__thread-preview']}>
                        {threadPreviewText(lastMessage)}
                      </span>
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
          </div>

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
                  {activeThread.isGroup ? (
                    <>
                      <Avatar
                        initials={activeThread.initials}
                        src={activeThread.avatarUrl}
                        size="md"
                      />
                      <span className={styles['messenger__chat-head-body']}>
                        <span className={styles['messenger__thread-name']}>
                          {activeThread.name}
                        </span>
                        <span className={styles['messenger__status']}>{activeThread.status}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles['messenger__chat-head-trigger']}
                        onClick={() => goToUserProfile(activeThread.participants[0].id)}
                      >
                        <Avatar
                          initials={activeThread.initials}
                          src={activeThread.avatarUrl}
                          size="md"
                          online={isOnlineStatus(activeThread.status)}
                        />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          styles['messenger__chat-head-trigger'],
                          styles['messenger__chat-head-name-trigger'],
                        )}
                        onClick={() => goToUserProfile(activeThread.participants[0].id)}
                      >
                        <span className={styles['messenger__chat-head-body']}>
                          <span className={styles['messenger__thread-name']}>
                            {activeThread.name}
                          </span>
                          <span className={styles['messenger__status']}>{activeThread.status}</span>
                        </span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={styles['messenger__add-participant-button']}
                    aria-label="Поиск по чату"
                    aria-expanded={isThreadSearchOpen}
                    onClick={() => setThreadSearchOpen((open) => !open)}
                  >
                    <SearchIcon />
                  </button>
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

                {isThreadSearchOpen && (
                  <ThreadSearchBar
                    threadId={activeThread.id}
                    onSelectMessage={(messageId) => {
                      scrollToMessage(messageId);
                      setThreadSearchOpen(false);
                    }}
                    onClose={() => setThreadSearchOpen(false)}
                  />
                )}

                {activeThread.pinnedMessages.length > 0 && (
                  <div className={styles['messenger__pinned-bar']}>
                    <PinIcon className={styles['messenger__pinned-icon']} />
                    {pinnedImage && (
                      // eslint-disable-next-line @next/next/no-img-element -- маленький превью-квадрат закреплённого сообщения, не подходит под next/image
                      <img
                        src={pinnedImage.url}
                        alt=""
                        className={styles['messenger__pinned-thumb']}
                      />
                    )}
                    <button
                      type="button"
                      className={styles['messenger__pinned-text']}
                      onClick={() => scrollToMessage(activeThread.pinnedMessages[pinnedIndex].id)}
                    >
                      {threadPreviewText(activeThread.pinnedMessages[pinnedIndex]) || 'Вложение'}
                    </button>
                    {activeThread.pinnedMessages.length > 1 && (
                      <button
                        type="button"
                        className={styles['messenger__pinned-next']}
                        aria-label="Следующее закреплённое сообщение"
                        onClick={() =>
                          setPinnedIndex(
                            (index) => (index + 1) % activeThread.pinnedMessages.length,
                          )
                        }
                      >
                        {pinnedIndex + 1}/{activeThread.pinnedMessages.length}
                      </button>
                    )}
                  </div>
                )}

                <div className={styles['messenger__chat-body-wrap']}>
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
                          {activeThread.isGroup && !row.mine && (
                            <ClusterSenderLabel
                              participants={activeThread.participants}
                              senderId={row.senderId}
                            />
                          )}
                          {row.messages.map((message, index) => (
                            <MessageBubble
                              key={message.id}
                              message={message}
                              position={{
                                isFirstInCluster: index === 0,
                                isLastInCluster: index === row.messages.length - 1,
                              }}
                              onEdit={() =>
                                startEditingMessage(activeThread.id, message.id, message.text)
                              }
                              onDelete={() =>
                                setDeletingMessage({
                                  threadId: activeThread.id,
                                  messageId: message.id,
                                })
                              }
                              onReply={() =>
                                startReplyingToMessage(
                                  activeThread.id,
                                  message.id,
                                  message.mine
                                    ? currentUser.name
                                    : (activeThread.participants.find(
                                        (participant) => participant.id === message.senderId,
                                      )?.name ?? 'Собеседник'),
                                  message.text,
                                  message.attachments.length > 0,
                                )
                              }
                              onForward={() =>
                                setForwardingMessage({
                                  sourceThreadId: activeThread.id,
                                  messageId: message.id,
                                })
                              }
                              onPin={() => void pinMessage(activeThread.id, message.id)}
                              onUnpin={() => void unpinMessage(activeThread.id, message.id)}
                              onAuthorClick={goToUserProfile}
                              onReplyQuoteClick={scrollToMessage}
                            />
                          ))}
                        </div>
                      ),
                    )}
                  </ScrollArea>

                  {showScrollButton && (
                    <button
                      type="button"
                      className={styles['messenger__scroll-bottom']}
                      onClick={scrollToBottom}
                      aria-label="Прокрутить к последним сообщениям"
                    >
                      <ChevronDownIcon />
                      {newMessageCount > 0 && (
                        <span className={styles['messenger__scroll-bottom-badge']}>
                          {newMessageCount}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                <MessageComposer threadId={activeThread.id} />
              </>
            ) : draftTarget ? (
              // Черновик — реального диалога ещё нет (см. `useThreadStore.draftTarget`),
              // поэтому ни статуса «в зале», ни истории сообщений, ни
              // добавления собеседника здесь быть не может: `Thread`
              // появится только вместе с первым сообщением из `MessageComposer`.
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
                  <button
                    type="button"
                    className={styles['messenger__chat-head-trigger']}
                    onClick={() => goToUserProfile(draftTarget.id)}
                  >
                    <Avatar initials={draftTarget.initials} src={draftTarget.avatarUrl} size="md" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      styles['messenger__chat-head-trigger'],
                      styles['messenger__chat-head-name-trigger'],
                    )}
                    onClick={() => goToUserProfile(draftTarget.id)}
                  >
                    <span className={styles['messenger__chat-head-body']}>
                      <span className={styles['messenger__thread-name']}>{draftTarget.name}</span>
                    </span>
                  </button>
                </header>

                <div className={styles['messenger__chat-body']}>
                  <EmptyState
                    className={styles['messenger__placeholder']}
                    title="Новый разговор"
                    description={`Ещё нет ни одного сообщения — напишите ${draftTarget.name} первым.`}
                  />
                </div>

                <MessageComposer threadId={null} />
              </>
            ) : (
              <div className={styles['messenger__placeholder']}>
                <span className={styles['messenger__placeholder-icon']}>
                  <MessagesIcon />
                </span>
                <p className={styles['messenger__placeholder-title']}>Выберите диалог</p>
                <p className={styles['messenger__placeholder-text']}>
                  Список слева — откройте разговор, чтобы увидеть сообщения.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {forwardingMessage && (
        <ForwardMessageModal
          threads={threads}
          onForward={(targetThreadId) =>
            forwardMessage(
              forwardingMessage.sourceThreadId,
              forwardingMessage.messageId,
              targetThreadId,
            )
          }
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {deletingMessage && (
        <Modal
          onClose={() => (isDeletingPending ? undefined : setDeletingMessage(null))}
          label="Удалить сообщение"
        >
          <div className={styles['messenger__delete-modal']}>
            <h2>Удалить сообщение?</h2>
            <p className={styles['messenger__delete-modal-hint']}>
              Необратимо: сообщение и его вложения пропадут для всех участников диалога.
            </p>
            {deleteError && (
              <p className={styles['messenger__delete-modal-error']}>{deleteError}</p>
            )}
            <div className={styles['messenger__delete-modal-actions']}>
              <Button
                variant="outline"
                onClick={() => setDeletingMessage(null)}
                disabled={isDeletingPending}
              >
                Отмена
              </Button>
              <Button
                className={styles['messenger__delete-modal-danger']}
                onClick={() => void confirmDeleteMessage()}
                disabled={isDeletingPending}
              >
                Удалить
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isAllThreadsSearchOpen && (
        <MessengerSearchModal
          threads={threads}
          onSelectMessage={openThreadAndScrollTo}
          onSelectThread={openThreadFromSearch}
          onSelectPerson={openPersonFromSearch}
          onClose={() => setAllThreadsSearchOpen(false)}
        />
      )}
    </main>
  );
}
