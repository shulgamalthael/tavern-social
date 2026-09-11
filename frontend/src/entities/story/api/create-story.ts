'use server';

import { backendUpload } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { Story } from '../model/types';
import { mapStory, type StoryResponse } from './map-story';

export async function createStory(file: Blob): Promise<Story> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const formData = new FormData();
  formData.append('file', file, 'story.jpg');

  const story = await backendUpload<StoryResponse>('/stories', { token, formData });
  return mapStory(story);
}
