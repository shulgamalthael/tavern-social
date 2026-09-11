export { getOrCreateDirectThread } from './api/get-or-create-direct-thread';
export { getThreads } from './api/get-threads';
export { mapMessage, mapSharedPost, mapThread } from './api/map-thread';
export type { MessageResponse, SharedPostResponse, ThreadResponse } from './api/map-thread';
export { searchAllThreads, searchThreadMessages } from './api/search-messages';
export type { ThreadSearchResult } from './api/search-messages';
export { selectUnreadThreadCount, useThreadStore } from './model/thread-store';
export type { ThreadStore } from './model/thread-store';
export type {
  ChatMessage,
  ForwardedFrom,
  MessageAttachment,
  ReplyTo,
  SharedPost,
  SharedPostAuthor,
  SharedPostPreview,
  Thread,
  ThreadParticipant,
} from './model/types';
