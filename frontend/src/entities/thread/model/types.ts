export interface ChatMessage {
  /** Стабильный id — React-ключ и защита от дублей при live-доставке
   * поверх reconnect-catchup (см. `thread-store.ts`, `receiveMessage`). */
  id: string;
  mine: boolean;
  text: string;
  createdAt: string;
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
}
