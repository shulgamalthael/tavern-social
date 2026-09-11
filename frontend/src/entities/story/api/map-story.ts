import { getInitials } from '@/shared/lib/get-initials';
import type { Story, StoryAuthor, StoryGroup, StoryViewerEntry } from '../model/types';

export interface StoryAuthorResponse {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface StoryResponse {
  id: string;
  imageUrl: string;
  createdAt: string;
  isMine: boolean;
  isViewedByMe: boolean;
}

export interface StoryGroupResponse {
  author: StoryAuthorResponse;
  stories: StoryResponse[];
  hasUnseen: boolean;
}

export interface StoryViewerEntryResponse {
  viewer: StoryAuthorResponse;
  viewedAt: string;
}

function mapStoryAuthor(author: StoryAuthorResponse): StoryAuthor {
  return {
    id: author.id,
    name: author.name,
    initials: getInitials(author.name),
    avatarUrl: author.avatarUrl,
  };
}

export function mapStory(story: StoryResponse): Story {
  return {
    id: story.id,
    imageUrl: story.imageUrl,
    createdAt: story.createdAt,
    isMine: story.isMine,
    isViewedByMe: story.isViewedByMe,
  };
}

export function mapStoryGroup(group: StoryGroupResponse): StoryGroup {
  return {
    author: mapStoryAuthor(group.author),
    stories: group.stories.map(mapStory),
    hasUnseen: group.hasUnseen,
  };
}

export function mapStoryViewerEntry(entry: StoryViewerEntryResponse): StoryViewerEntry {
  return { viewer: mapStoryAuthor(entry.viewer), viewedAt: entry.viewedAt };
}
