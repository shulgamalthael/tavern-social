import type { PublicProfile } from '@/modules/users/users.types';

export interface MessageDto {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ThreadDto {
  id: string;
  /** Все участники диалога, кроме текущего пользователя — один для 1:1,
   * несколько для группового диалога (см. `ThreadsService.addParticipant`). */
  participants: PublicProfile[];
  isGroup: boolean;
  /** Для 1:1 — присутствие собеседника ("здесь" / "не в зале сейчас"),
   * для группы — количество участников. */
  status: string;
  unreadCount: number;
  messages: MessageDto[];
}
