import { getInitials } from '@/shared/lib/get-initials';
import type {
  ChatMessage,
  ForwardedFrom,
  MessageAttachment,
  ReplyTo,
  SharedPost,
  SharedPostAuthor,
  Thread,
  ThreadParticipant,
} from '../model/types';

export interface ThreadParticipantResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface MessageAttachmentResponse {
  id: string;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}

export interface ForwardedFromResponse {
  id: string;
  senderId: string;
  senderName: string;
}

export interface ReplyToResponse {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  hasAttachment: boolean;
}

export interface SharedPostAuthorResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface SharedPostPreviewResponse {
  id: string;
  author: SharedPostAuthorResponse;
  wallOwnerId: string | null;
  text: string;
  images: string[];
}

export type SharedPostResponse =
  | { status: 'visible'; post: SharedPostPreviewResponse }
  | { status: 'restricted'; author: SharedPostAuthorResponse }
  | { status: 'not_found' };

export interface MessageResponse {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  pinnedAt: string | null;
  attachments: MessageAttachmentResponse[];
  forwardedFrom: ForwardedFromResponse | null;
  replyTo: ReplyToResponse | null;
  sharedPost: SharedPostResponse | null;
}

export interface ThreadResponse {
  id: string;
  participants: ThreadParticipantResponse[];
  isGroup: boolean;
  status: string;
  unreadCount: number;
  messages: MessageResponse[];
  pinnedMessages: MessageResponse[];
}

function mapAttachment(attachment: MessageAttachmentResponse): MessageAttachment {
  return {
    id: attachment.id,
    url: attachment.url,
    mimeType: attachment.mimeType,
    fileName: attachment.fileName,
    sizeBytes: attachment.sizeBytes,
  };
}

function mapForwardedFrom(forwardedFrom: ForwardedFromResponse | null): ForwardedFrom | null {
  if (!forwardedFrom) return null;
  return {
    id: forwardedFrom.id,
    senderId: forwardedFrom.senderId,
    senderName: forwardedFrom.senderName,
  };
}

function mapReplyTo(replyTo: ReplyToResponse | null): ReplyTo | null {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    senderId: replyTo.senderId,
    senderName: replyTo.senderName,
    text: replyTo.text,
    hasAttachment: replyTo.hasAttachment,
  };
}

function mapSharedPostAuthor(author: SharedPostAuthorResponse): SharedPostAuthor {
  return {
    id: author.id,
    name: author.name,
    initials: getInitials(author.name),
    avatarUrl: author.avatarUrl,
  };
}

export function mapSharedPost(sharedPost: SharedPostResponse | null): SharedPost | null {
  if (!sharedPost) return null;
  if (sharedPost.status === 'visible') {
    return {
      status: 'visible',
      post: {
        id: sharedPost.post.id,
        author: mapSharedPostAuthor(sharedPost.post.author),
        wallOwnerId: sharedPost.post.wallOwnerId,
        text: sharedPost.post.text,
        images: sharedPost.post.images,
      },
    };
  }
  if (sharedPost.status === 'restricted') {
    return { status: 'restricted', author: mapSharedPostAuthor(sharedPost.author) };
  }
  return { status: 'not_found' };
}

export function mapMessage(message: MessageResponse, currentUserId: string): ChatMessage {
  return {
    id: message.id,
    mine: message.senderId === currentUserId,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    pinnedAt: message.pinnedAt,
    attachments: message.attachments.map(mapAttachment),
    forwardedFrom: mapForwardedFrom(message.forwardedFrom),
    replyTo: mapReplyTo(message.replyTo),
    sharedPost: mapSharedPost(message.sharedPost),
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
    pinnedMessages: thread.pinnedMessages.map((message) => mapMessage(message, currentUserId)),
  };
}
