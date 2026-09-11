import { create } from 'zustand';

/**
 * Компактные всплывающие попапы для real-time событий — отдельный store от
 * `notification-store`, потому что это разные заботы: тут «что сейчас
 * показать на экране и когда убрать», там — персистентная лента с пагинацией
 * (см. AGENTS.md, раздел 4: «не помещайте всё в один store»).
 */
export type ToastItem =
  | {
      id: string;
      key: string;
      kind: 'message';
      threadId: string;
      senderId: string;
      senderName: string;
      senderInitials: string;
      senderAvatarUrl: string | null;
      preview: string;
    }
  | {
      id: string;
      key: string;
      kind: 'friend-request';
      senderId: string;
      senderName: string;
      senderInitials: string;
      senderAvatarUrl: string | null;
    }
  | {
      id: string;
      key: string;
      kind: 'friend-accepted';
      actorId: string;
      name: string;
      initials: string;
      avatarUrl: string | null;
    }
  | {
      id: string;
      key: string;
      kind: 'subscription-request';
      senderId: string;
      senderName: string;
      senderInitials: string;
      senderAvatarUrl: string | null;
    }
  | {
      id: string;
      key: string;
      kind: 'subscription-accepted';
      actorId: string;
      name: string;
      initials: string;
      avatarUrl: string | null;
    }
  | {
      id: string;
      key: string;
      kind: 'post-like' | 'post-repost';
      notificationId: string;
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorAvatarUrl: string | null;
      actorCount: number;
      /** Реакция на фото галереи — влияет только на текст («фотографию» вместо «запись»). */
      hasImage: boolean;
    }
  | {
      id: string;
      key: string;
      kind: 'post-comment';
      notificationId: string;
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorAvatarUrl: string | null;
      commentText: string;
    }
  | {
      id: string;
      key: string;
      kind: 'group-join-request';
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorAvatarUrl: string | null;
      groupId: string;
      groupName: string;
    }
  | {
      id: string;
      key: string;
      kind: 'group-join-accepted';
      actorId: string;
      actorName: string;
      actorInitials: string;
      actorAvatarUrl: string | null;
      groupId: string;
      groupName: string;
    };

/** `Omit` над union теряет специфичные для варианта поля (`keyof` объединения
 * — только общие ключи) — распределяем `Omit` по каждому варианту вручную. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type ToastInput = DistributiveOmit<ToastItem, 'id'>;

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5000;

interface ToastState {
  visible: ToastItem[];
  queue: ToastItem[];
}

interface ToastActions {
  /** Дедуплицирует по `key` — повторное событие того же диалога/уведомления
   * обновляет существующий toast на месте, а не добавляет ещё один (серия
   * сообщений/лайков не превращается в стопку одинаковых попапов). */
  enqueue: (item: ToastInput) => void;
  dismiss: (id: string) => void;
}

export type ToastStore = ToastState & ToastActions;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `toast-${Date.now()}-${counter}`;
}

/** По id тоста — таймер его автозакрытия. Живёт вне стора: не часть
 * отображаемого состояния, а служебный побочный эффект `enqueue`/`dismiss`. */
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * (Пере)запускает таймер автозакрытия. Вызывается и при первом появлении
 * тоста, и при обновлении уже видимого (дедуп по `key`) — без сброса старый
 * таймер продолжал бы отсчёт с момента первого показа, и обновлённый тост
 * (например, «и ещё N человек» после нового лайка) мог закрыться почти
 * сразу после обновления, не дав шанса его заметить.
 */
function scheduleAutoDismiss(id: string): void {
  const existing = dismissTimers.get(id);
  if (existing) clearTimeout(existing);
  dismissTimers.set(
    id,
    setTimeout(() => {
      dismissTimers.delete(id);
      useToastStore.getState().dismiss(id);
    }, AUTO_DISMISS_MS),
  );
}

function cancelAutoDismiss(id: string): void {
  const existing = dismissTimers.get(id);
  if (existing) {
    clearTimeout(existing);
    dismissTimers.delete(id);
  }
}

export const useToastStore = create<ToastStore>((set, get) => ({
  visible: [],
  queue: [],
  enqueue: (input) => {
    const { visible, queue } = get();

    const visibleMatch = visible.find((item) => item.key === input.key);
    if (visibleMatch) {
      set({
        visible: visible.map((item) =>
          item.key === input.key ? ({ ...input, id: item.id } as ToastItem) : item,
        ),
      });
      scheduleAutoDismiss(visibleMatch.id);
      return;
    }

    const queuedMatch = queue.find((item) => item.key === input.key);
    if (queuedMatch) {
      set({
        queue: queue.map((item) =>
          item.key === input.key ? ({ ...input, id: item.id } as ToastItem) : item,
        ),
      });
      return;
    }

    const toast = { ...input, id: nextId() } as ToastItem;
    if (visible.length < MAX_VISIBLE) {
      set({ visible: [...visible, toast] });
      scheduleAutoDismiss(toast.id);
    } else {
      set({ queue: [...queue, toast] });
    }
  },
  dismiss: (id) => {
    cancelAutoDismiss(id);
    const { visible, queue } = get();
    const stillVisible = visible.filter((item) => item.id !== id);
    if (stillVisible.length === visible.length) {
      // Не была на экране — значит ждала в очереди.
      set({ queue: queue.filter((item) => item.id !== id) });
      return;
    }

    const [next, ...restQueue] = queue;
    if (next) scheduleAutoDismiss(next.id);
    set({ visible: next ? [...stillVisible, next] : stillVisible, queue: restQueue });
  },
}));
