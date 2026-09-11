'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import { getSessionToken } from '@/shared/lib/session-token.server';
import type { StoryGroup } from '../model/types';
import { mapStoryGroup, type StoryGroupResponse } from './map-story';

export async function getStoriesTray(): Promise<StoryGroup[]> {
  const token = await getSessionToken();
  if (!token) throw new Error('Сессия истекла — обновите страницу');

  const groups = await backendFetch<StoryGroupResponse[]>('/stories/tray', { token });
  return groups.map(mapStoryGroup);
}
