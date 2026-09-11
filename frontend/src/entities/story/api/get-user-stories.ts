'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { StoryGroup } from '../model/types';
import { mapStoryGroup, type StoryGroupResponse } from './map-story';

/** Гейтится на backend `assertCanViewRestrictedContent` (см.
 * `StoriesService.getForUser`) — фронт ничего дополнительно не проверяет,
 * как и с постами/галереей чужой стены. */
export async function getUserStories(userId: string): Promise<StoryGroup> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const group = await backendFetch<StoryGroupResponse>(`/stories/user/${userId}`, { token });
  return mapStoryGroup(group);
}
