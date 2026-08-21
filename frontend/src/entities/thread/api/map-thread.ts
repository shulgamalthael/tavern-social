import { getInitials } from '@/shared/lib/get-initials';
import type { ChatMessage, Thread, ThreadParticipant } from '../model/types';

export interface ThreadParticipantResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface MessageResponse {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ThreadResponse {
  id: string;
  participants: ThreadParticipantResponse[];
  isGroup: boolean;
  status: string;
  unreadCount: number;
  messages: MessageResponse[];
}

export function mapMessage(message: MessageResponse, currentUserId: string): ChatMessage {
  return {
    id: message.id,
    mine: message.senderId === currentUserId,
    text: message.text,
    createdAt: message.createdAt,
  };
}

export function mapParticipant(participant: ThreadParticipantResponse): ThreadParticipant {
  return {
    id: participant.id,
    name: participant.name,
    initials: getInitials(participant.name),
    avatarUrl: participant.avatarUrl,
  };
}

/** Имена участников через запятую — у диалога нет отдельного поля
 * «название», группа отображается через собеседников (как в Telegram, пока
 * никто не задал название чату вручную). */
export function displayNameFor(participants: ThreadParticipant[]): string {
  return participants.map((participant) => participant.name).join(', ');
}

export function mapThread(thread: ThreadResponse, currentUserId: string): Thread {
  const participants = thread.participants.map(mapParticipant);
  const name = displayNameFor(participants);

  return {
    id: thread.id,
    participants,
    isGroup: thread.isGroup,
    name,
    initials: getInitials(name),
    // Единый аватар есть только у 1:1-диалога — у группового его нет
    // (аналогично `initials`, синтезируемым из объединённого имени).
    avatarUrl: participants.length === 1 ? participants[0].avatarUrl : null,
    status: thread.status,
    unread: thread.unreadCount || undefined,
    messages: thread.messages.map((message) => mapMessage(message, currentUserId)),
  };
}
