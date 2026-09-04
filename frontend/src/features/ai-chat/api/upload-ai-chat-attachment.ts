'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { ChatAttachment } from '../model/types';

/**
 * Загружает вложение AI-чата ДО отправки сообщения (`POST .../ai/chat/
 * attachments`, `AiController.uploadAttachment`) — отдельный запрос от
 * самого чата: `chat/stream` — `@Sse()`, мешать в неё multipart-загрузку
 * рискованно (см. комментарий контроллера про гонку `@Sse()`'s заголовков
 * с async-работой). Возвращённый `id` дальше уходит в `streamAiChat` как
 * элемент `attachmentIds`.
 */
export async function uploadAiChatAttachment(
  businessId: string,
  file: File,
): Promise<ChatAttachment> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file);

  return backendUpload<ChatAttachment>(`/businesses/${businessId}/ai/chat/attachments`, {
    token,
    formData,
  });
}
