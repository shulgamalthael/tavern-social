export interface MessageAttachment {
  id: string;
  url: string;
  mimeType: string;
  /** Имя, под которым файл загрузили — не имя на диске (то — случайный
   * UUID, см. backend `common/lib/upload.ts`), только для отображения. */
  fileName: string;
  sizeBytes: number;
}

/** Снимок «кто и что переслал» на момент пересылки — не живая ссылка на
 * оригинал (см. backend `ThreadsService.forwardMessage`): если оригинал
 * потом отредактируют, пересланная копия не должна тихо измениться вместе
 * с ним. */
export interface ForwardedFrom {
  id: string;
  senderId: string;
  senderName: string;
}

/** На что отвечает сообщение — живая ссылка, не снимок (в отличие от
 * `ForwardedFrom`): если оригинал отредактируют, цитата в ответе меняется
 * вместе с ним (см. backend `ThreadsService`, `ReplyToDto`).
 * `hasAttachment` — только флаг, чтобы показать «Вложение» вместо пустого
 * текста цитаты, без подгрузки самих вложений оригинала. */
export interface ReplyTo {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hasAttachment: boolean;
}

export interface ChatMessage {
  /** Стабильный id — React-ключ и защита от дублей при live-доставке
   * поверх reconnect-catchup (см. `thread-store.ts`, `receiveMessage`). */
  id: string;
  mine: boolean;
  /** Кто отправил — для `mine` совпадает с текущим пользователем, но нужен
   * не только для этого: в групповом чате разные собеседники (все — не
   * `mine`) должны кластеризоваться и подписываться отдельно, а не сливаться
   * в одного «неизвестного отправителя» (см. `widgets/messenger`,
   * `buildChatRows`/аватар+имя над цепочкой чужих сообщений). */
  senderId: string;
  text: string;
  createdAt: string;
  /** Заполнено, если сообщение редактировали — момент последнего изменения. */
  editedAt: string | null;
  /** Заполнено, если сообщение закреплено в треде. */
  pinnedAt: string | null;
  attachments: MessageAttachment[];
  forwardedFrom: ForwardedFrom | null;
  replyTo: ReplyTo | null;
}

export interface ThreadParticipant {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export interface Thread {
  id: string;
  /** Все участники диалога, кроме меня — один для 1:1, несколько для
   * группового (см. `widgets/messenger/ui/AddParticipantDropdown`). */
  participants: ThreadParticipant[];
  isGroup: boolean;
  /** Имена собеседников через запятую — синтезируется на фронте, у диалога
   * нет отдельного поля «название» (см. `map-thread.ts`). */
  name: string;
  initials: string;
  /** Аватар собеседника — только для 1:1, у группового диалога нет единого
   * аватара (как и с `initials`, см. `map-thread.ts`). */
  avatarUrl: string | null;
  status: string;
  unread?: number;
  messages: ChatMessage[];
  /** Закреплённые сообщения — от новых к старым (см. backend `ThreadsService.toDto`). */
  pinnedMessages: ChatMessage[];
}
