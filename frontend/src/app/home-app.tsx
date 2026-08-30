'use client';

import { type ComponentType, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getBusinesses } from '@/entities/business';
import { useFriendStore } from '@/entities/friend';
import {
  type NotificationType,
  useNotificationStore,
  useToastStore,
} from '@/entities/notification';
import { usePostStore } from '@/entities/post';
import { mapMessage, mapThread, type ThreadResponse, useThreadStore } from '@/entities/thread';
import { useCurrentUser } from '@/entities/user';
import { getSocketTicket } from '@/features/auth';
import { type SectionId, useNavigationStore } from '@/features/section-navigation';
import { BACKEND_WS_URL } from '@/shared/config/realtime';
import { cn } from '@/shared/lib/cn';
import { getInitials } from '@/shared/lib/get-initials';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { usePersistedScroll } from '@/shared/lib/use-persisted-scroll';
import { AdminBar } from '@/widgets/admin';
import { BusinessOwnerBar } from '@/widgets/business-owner-bar';
import { CommunitiesWidget } from '@/widgets/communities';
import { FeedWidget } from '@/widgets/feed';
import { FriendsWidget } from '@/widgets/friends';
import { GroupsWidget } from '@/widgets/groups';
import { Header } from '@/widgets/header';
import { MessengerWidget } from '@/widgets/messenger';
import { NavigationDock } from '@/widgets/navigation-dock';
import { NotificationToaster } from '@/widgets/notification-toaster';
import { NotificationsWidget } from '@/widgets/notifications';
import { ProfileWidget } from '@/widgets/profile';
import { SettingsWidget } from '@/widgets/settings';
import styles from './page.module.scss';

const SECTION_WIDGETS: Record<SectionId, ComponentType> = {
  profile: ProfileWidget,
  feed: FeedWidget,
  messages: MessengerWidget,
  friends: FriendsWidget,
  communities: CommunitiesWidget,
  groups: GroupsWidget,
  settings: SettingsWidget,
  notifications: NotificationsWidget,
};

interface IncomingMessageAttachment {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

interface IncomingForwardedFrom {
  id: string;
  senderId: string;
  senderName: string;
}

interface IncomingReplyTo {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hasAttachment: boolean;
}

interface IncomingMessage {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  attachments: IncomingMessageAttachment[];
  forwardedFrom: IncomingForwardedFrom | null;
  replyTo: IncomingReplyTo | null;
}

interface IncomingMessageDeleted {
  threadId: string;
  messageId: string;
}

interface IncomingActor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface IncomingFriendEvent {
  notificationId: string;
  actor: IncomingActor;
}

interface IncomingGroupJoinEvent {
  notificationId: string;
  actor: IncomingActor;
  group: { id: string; name: string };
}

interface IncomingParticipantAdded {
  threadId: string;
  participant: IncomingActor;
}

interface IncomingNotification {
  notificationId: string;
  type: Extract<NotificationType, 'post_like' | 'post_repost' | 'post_comment'>;
  actor: IncomingActor;
  actorCount: number;
  isNew: boolean;
  post: { id: string; text: string; hasImage: boolean };
  commentText?: string;
}

/**
 * Разделы переключаются на клиенте через store, а не через отдельные роуты
 * Next.js — сохраняем поведение исходного макета (мобильный UX «как в приложении»,
 * без перезагрузки шапки/навигации между разделами). См. PROJECT_CONTEXT.md.
 */
export function HomeApp() {
  const section = useNavigationStore((state) => state.section);
  const ActiveSection = SECTION_WIDGETS[section];
  const loadPosts = usePostStore((state) => state.loadPosts);
  const loadThreads = useThreadStore((state) => state.loadThreads);
  const loadUnreadCount = useNotificationStore((state) => state.loadUnreadCount);
  const { currentUser } = useCurrentUser();
  const appRef = useRef<HTMLDivElement>(null);
  usePersistedScroll(appRef);
  // Собственные бизнесы текущего пользователя — только для `BusinessOwnerBar`
  // ниже, больше никто на этом экране их не читает, поэтому обычный
  // `useAsyncData`, а не отдельный Zustand-стор (тот же принцип, что и у
  // остальных данных, нужных ровно одному месту, см. AGENTS.md раздел 4).
  const ownedBusinesses = useAsyncData(getBusinesses).data ?? [];

  useEffect(() => {
    loadPosts();
    loadThreads();
    loadUnreadCount();
    // Один раз при монтировании оболочки приложения — и лента, и мессенджер,
    // и счётчик непрочитанных в шапке используют один и тот же результат.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Единственное Socket.IO-соединение приложения (singleton) — создаётся
    // здесь и только здесь. Новый real-time сценарий добавляется как ещё
    // один `socket.on(...)` ниже, который диспатчит в соответствующий
    // domain-store (`entities/*`) — никогда напрямую в UI (см. AGENTS.md,
    // раздел про real-time).
    //
    // `auth` — функция, а не объект: билет одноразовый
    // (SocketTicketsService.consume() удаляет его при первом использовании),
    // а Socket.IO переиспользует объект-`auth` на каждой попытке
    // автоматического reconnect. Если передать билет один раз как объект,
    // после ЛЮБОГО разрыва соединения все дальнейшие reconnect-попытки будут
    // молча и навсегда отклоняться backend'ом (уже использованный билет).
    // Функция вызывается заново перед каждой попыткой подключения — включая
    // reconnect — и всегда запрашивает свежий билет.
    const socket = io(BACKEND_WS_URL, {
      auth: (callback) => {
        void getSocketTicket().then((ticket) => callback({ ticket: ticket ?? '' }));
      },
    });

    socket.on('connect', () => {
      // Срабатывает и на первом подключении, и на каждом успешном reconnect —
      // Socket.IO не буферизует пропущенные события, поэтому досинхронизируем
      // диалоги и счётчик уведомлений через REST на случай, если что-то
      // пришло, пока соединения не было.
      void loadThreads();
      void useNotificationStore.getState().loadUnreadCount();
    });

    socket.on('connect_error', (error: Error) => {
      console.warn('[socket] не удалось подключиться:', error.message);
    });

    socket.on('disconnect', (reason: string) => {
      console.warn('[socket] соединение потеряно:', reason);
    });

    socket.on('message:new', (message: IncomingMessage) => {
      // Сообщения, отправленные мной, уже добавлены оптимистично в
      // `sendMessage` (Server Action) — socket-эхо от собственного
      // сообщения игнорируем, иначе оно продублируется в чате.
      if (message.senderId === currentUser.id) return;
      useThreadStore.getState().receiveMessage(message.threadId, {
        id: message.id,
        mine: false,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt,
        editedAt: message.editedAt,
        pinnedAt: message.pinnedAt,
        attachments: message.attachments,
        forwardedFrom: message.forwardedFrom,
        replyTo: message.replyTo,
      });

      // Диалог уже открыт и виден — сообщение и так появится живым в самом
      // чате, дублировать его тостом поверх незачем (как в Telegram).
      if (useThreadStore.getState().activeThreadId === message.threadId) return;

      const thread = useThreadStore.getState().threads.find((t) => t.id === message.threadId);
      if (thread) {
        useToastStore.getState().enqueue({
          key: `message:${thread.id}`,
          kind: 'message',
          threadId: thread.id,
          senderId: message.senderId,
          senderName: thread.name,
          senderInitials: thread.initials,
          senderAvatarUrl: thread.avatarUrl,
          preview: message.text,
        });
      }
    });

    socket.on('message:edited', (message: IncomingMessage) => {
      // Редактировать можно только своё сообщение (backend проверяет) —
      // значит `senderId` здесь всегда автор правки; свою же правку я уже
      // применил оптимистично в `editMessage` (см. `useThreadStore`), эхо
      // по сокету игнорирую тем же приёмом, что и у `message:new`.
      if (message.senderId === currentUser.id) return;
      useThreadStore
        .getState()
        .receiveMessageEdit(message.threadId, mapMessage(message, currentUser.id));
    });

    socket.on('message:deleted', (payload: IncomingMessageDeleted) => {
      // Как и `thread:pinned-changed` — эхо собственного удаления не
      // фильтруем: `receiveMessageDeleted` идемпотентно убирает по id,
      // повторное удаление уже отсутствующего сообщения — no-op.
      useThreadStore.getState().receiveMessageDeleted(payload.threadId, payload.messageId);
    });

    socket.on('thread:pinned-changed', (thread: ThreadResponse) => {
      // Закрепить/открепить может любой участник, не только автор
      // сообщения — в отличие от `message:new`/`message:edited`, здесь эхо
      // собственного действия не пропускаем: `receiveThreadUpdate` просто
      // идемпотентно заменяет тред тем же самым объектом.
      useThreadStore.getState().receiveThreadUpdate(mapThread(thread, currentUser.id));
    });

    socket.on('friend-request:new', (payload: IncomingFriendEvent) => {
      useFriendStore.getState().receiveNewRequest();
      useNotificationStore.getState().receiveRealtimeUnread();
      useToastStore.getState().enqueue({
        key: `friend-request:${payload.actor.id}`,
        kind: 'friend-request',
        senderId: payload.actor.id,
        senderName: payload.actor.name,
        senderInitials: getInitials(payload.actor.name),
        senderAvatarUrl: payload.actor.avatarUrl,
      });
    });

    socket.on('friend-request:accepted', (payload: IncomingFriendEvent) => {
      useFriendStore.getState().receiveAccepted();
      useNotificationStore.getState().receiveRealtimeUnread();
      useToastStore.getState().enqueue({
        key: `friend-accepted:${payload.actor.id}`,
        kind: 'friend-accepted',
        actorId: payload.actor.id,
        name: payload.actor.name,
        initials: getInitials(payload.actor.name),
        avatarUrl: payload.actor.avatarUrl,
      });
    });

    socket.on('friend-request:removed', () => useFriendStore.getState().receiveRemoved());
    socket.on('friend:removed', () => useFriendStore.getState().receiveFriendRemoved());

    socket.on('group-join-request:new', (payload: IncomingGroupJoinEvent) => {
      useNotificationStore.getState().receiveRealtimeUnread();
      useToastStore.getState().enqueue({
        key: `group-join-request:${payload.group.id}:${payload.actor.id}`,
        kind: 'group-join-request',
        actorId: payload.actor.id,
        actorName: payload.actor.name,
        actorInitials: getInitials(payload.actor.name),
        actorAvatarUrl: payload.actor.avatarUrl,
        groupId: payload.group.id,
        groupName: payload.group.name,
      });
    });

    socket.on('group-join-request:accepted', (payload: IncomingGroupJoinEvent) => {
      useNotificationStore.getState().receiveRealtimeUnread();
      useToastStore.getState().enqueue({
        key: `group-join-accepted:${payload.group.id}`,
        kind: 'group-join-accepted',
        actorId: payload.actor.id,
        actorName: payload.actor.name,
        actorInitials: getInitials(payload.actor.name),
        actorAvatarUrl: payload.actor.avatarUrl,
        groupId: payload.group.id,
        groupName: payload.group.name,
      });
    });

    socket.on('thread:participant-added', (payload: IncomingParticipantAdded) => {
      useThreadStore.getState().receiveParticipantAdded(payload.threadId, payload.participant);
    });

    socket.on('notification:new', (payload: IncomingNotification) => {
      // Собственные действия на своём же контенте сюда не долетают —
      // backend их не отправляет (см. `PostsController`), но событие
      // всё равно приходит только адресату (`emitToUser`), не автору.
      //
      // `isNew` — сгруппированное обновление (ещё один лайк/репост того же
      // типа на тот же пост, пока прошлое уведомление не прочитано) не
      // создаёт новую строку в `notifications`, поэтому не должно ещё раз
      // увеличивать счётчик непрочитанных (см. `NotificationsService.notifyPostInteraction`).
      if (payload.isNew) {
        useNotificationStore.getState().receiveRealtimeUnread();
      }

      const actorInitials = getInitials(payload.actor.name);
      useToastStore.getState().enqueue(
        payload.type === 'post_comment'
          ? {
              key: `notification:${payload.notificationId}`,
              kind: 'post-comment',
              notificationId: payload.notificationId,
              actorId: payload.actor.id,
              actorName: payload.actor.name,
              actorInitials,
              actorAvatarUrl: payload.actor.avatarUrl,
              commentText: payload.commentText ?? '',
            }
          : {
              key: `notification:${payload.notificationId}`,
              kind: payload.type === 'post_repost' ? 'post-repost' : 'post-like',
              notificationId: payload.notificationId,
              actorId: payload.actor.id,
              actorName: payload.actor.name,
              actorInitials,
              actorAvatarUrl: payload.actor.avatarUrl,
              actorCount: payload.actorCount,
              hasImage: payload.post.hasImage,
            },
      );
    });

    return () => {
      socket.close();
    };
    // loadThreads — стабильный экшен Zustand-стора, его ссылка не меняется
    // между рендерами, добавлен в зависимости только чтобы не отключать
    // exhaustive-deps.
  }, [currentUser.id, loadThreads]);

  const isAdmin = currentUser.role === 'admin';
  // Мессенджер — единственный раздел, задуманный как полноэкранное
  // приложение-в-приложении (см. `widgets/messenger`, «весь экран, как
  // Telegram Web») — шапка сайта над ним не нужна ни на каком экране: у неё
  // есть свой заголовок треда/диалога и кнопка «назад» внутри самого
  // `MessengerWidget`, а `NavigationDock` (см. ниже) остаётся видимым и так
  // даёт полную навигацию по разделам. Раньше прятали только на мобильном/
  // планшетном экране (шапка отъедала заметную долю чата при нехватке
  // вертикального места) — на десктопе места достаточно, но сама шапка
  // всё равно лишняя для этого раздела, см. `.app__top--collapsed` в
  // page.module.scss (без брейкпоинта — теперь безусловно).
  const hideHeader = section === 'messages';

  const hasBusinesses = ownedBusinesses.length > 0;

  return (
    <div
      className={cn(
        styles.app,
        isAdmin && styles['app--with-admin-bar'],
        hasBusinesses && styles['app--with-business-bar'],
      )}
      ref={appRef}
    >
      <div className={cn(styles['app__top'], hideHeader && styles['app__top--collapsed'])}>
        {isAdmin && <AdminBar />}
        {hasBusinesses && <BusinessOwnerBar businesses={ownedBusinesses} />}
        <Header containerRef={appRef} />
      </div>
      <ActiveSection />
      <NavigationDock />
      <NotificationToaster />
    </div>
  );
}
