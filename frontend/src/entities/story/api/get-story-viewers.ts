'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { StoryViewerEntry } from '../model/types';
import { mapStoryViewerEntry, type StoryViewerEntryResponse } from './map-story';

/** Список видят только сам автор истории — backend отвечает
 * `ForbiddenException`, если это не так (`StoriesService.getViewers`). */
export async function getStoryViewers(storyId: string): Promise<StoryViewerEntry[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const entries = await backendFetch<StoryViewerEntryResponse[]>(`/stories/${storyId}/viewers`, {
    token,
  });
  return entries.map(mapStoryViewerEntry);
}
