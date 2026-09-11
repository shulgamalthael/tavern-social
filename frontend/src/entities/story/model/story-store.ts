import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { createStory } from '../api/create-story';
import { deleteStory } from '../api/delete-story';
import { getStoriesTray } from '../api/get-stories-tray';
import { markStoryViewed } from '../api/mark-story-viewed';
import type { StoryGroup } from './types';

interface StoryState {
  tray: StoryGroup[];
  status: AsyncStatus;
  error: string | null;
}

interface StoryActions {
  loadTray: () => Promise<void>;
  /** Загружает файл и добавляет результат в свою группу — backend
   * (`StoriesService.getTray`) всегда кладёт свою группу первой в массиве,
   * поэтому здесь достаточно `tray[0]`, а не искать группу по id автора
   * (текущий пользователь — React Context, не доступен из стора, см.
   * AGENTS.md §5). */
  addStory: (file: Blob) => Promise<void>;
  removeStory: (storyId: string) => Promise<void>;
  /** Отмечает историю просмотренной и локально, и на backend — тот же
   * оптимистичный паттерн, что и у реакций на посты: кольцо в UI гаснет
   * сразу, не дожидаясь ответа сервера. */
  markViewed: (storyId: string) => void;
}

export type StoryStore = StoryState & StoryActions;

function recomputeHasUnseen(group: StoryGroup): boolean {
  return group.stories.some((story) => !story.isMine && !story.isViewedByMe);
}

export const useStoryStore = create<StoryStore>((set, get) => ({
  tray: [],
  status: 'idle',
  error: null,

  loadTray: async () => {
    set({ status: 'loading', error: null });
    try {
      const tray = await getStoriesTray();
      set({ tray, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить истории',
      });
    }
  },

  addStory: async (file) => {
    const story = await createStory(file);
    set((state) => {
      const [own, ...rest] = state.tray;
      if (!own) return state;
      return { tray: [{ ...own, stories: [story, ...own.stories] }, ...rest] };
    });
  },

  removeStory: async (storyId) => {
    await deleteStory(storyId);
    set((state) => ({
      tray: state.tray.map((group) => {
        if (!group.stories.some((story) => story.id === storyId)) return group;
        const stories = group.stories.filter((story) => story.id !== storyId);
        return { ...group, stories, hasUnseen: recomputeHasUnseen({ ...group, stories }) };
      }),
    }));
  },

  markViewed: (storyId) => {
    const alreadyViewed = get().tray.some((group) =>
      group.stories.some((story) => story.id === storyId && story.isViewedByMe),
    );
    if (alreadyViewed) return;

    set((state) => ({
      tray: state.tray.map((group) => {
        if (!group.stories.some((story) => story.id === storyId)) return group;
        const stories = group.stories.map((story) =>
          story.id === storyId ? { ...story, isViewedByMe: true } : story,
        );
        return { ...group, stories, hasUnseen: recomputeHasUnseen({ ...group, stories }) };
      }),
    }));
    void markStoryViewed(storyId);
  },
}));
