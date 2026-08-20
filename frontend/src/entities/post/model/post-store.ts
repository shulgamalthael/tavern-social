import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { createPost } from '../api/create-post';
import { getPosts } from '../api/get-posts';
import { togglePostLike } from '../api/toggle-post-like';
import { togglePostRepost } from '../api/toggle-post-repost';
import type { Post } from './types';

interface PostState {
  posts: Post[];
  status: AsyncStatus;
  error: string | null;
  likedPostIds: Record<string, boolean>;
  repostedPostIds: Record<string, boolean>;
}

interface PostActions {
  loadPosts: () => Promise<void>;
  publishPost: (input: { text: string }) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
}

export type PostStore = PostState & PostActions;

/** Карточка репоста показывает статистику оригинала — поэтому лайк/репост,
 * применённый к его id, должен обновить и её отображение, а не только
 * карточку самого оригинала (см. AGENTS.md, раздел про репосты). */
export function matchesTarget(post: Post, targetId: string): boolean {
  return post.id === targetId || post.repostOf?.id === targetId;
}

/**
 * Посты нужны и ленте, и стене профиля (там показываются последние 3) —
 * общий store вместо дублирования состояния в двух виджетах. Список
 * загружается один раз при старте приложения (см. `app/home-app.tsx`).
 */
export const usePostStore = create<PostStore>((set, get) => ({
  posts: [],
  status: 'idle',
  error: null,
  likedPostIds: {},
  repostedPostIds: {},
  loadPosts: async () => {
    set({ status: 'loading', error: null });
    try {
      const { posts, likedPostIds, repostedPostIds } = await getPosts();
      set({ posts, likedPostIds, repostedPostIds, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить ленту',
      });
    }
  },
  publishPost: async ({ text }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const post = await createPost(trimmed);
    set((state) => ({ posts: [post, ...state.posts] }));
  },
  toggleLike: async (postId) => {
    const wasLiked = Boolean(get().likedPostIds[postId]);
    const nextLiked = !wasLiked;

    // Оптимистичное обновление — сразу отражаем ожидаемый результат,
    // затем сверяемся с ответом backend (счётчик — общий, не только «мой»).
    set((state) => ({
      likedPostIds: { ...state.likedPostIds, [postId]: nextLiked },
      posts: state.posts.map((post) =>
        matchesTarget(post, postId) ? { ...post, likes: post.likes + (nextLiked ? 1 : -1) } : post,
      ),
    }));

    try {
      const result = await togglePostLike(postId, nextLiked);
      set((state) => ({
        likedPostIds: { ...state.likedPostIds, [postId]: result.isLikedByMe },
        posts: state.posts.map((post) =>
          matchesTarget(post, postId) ? { ...post, likes: result.likes } : post,
        ),
      }));
    } catch {
      // Откатываем оптимистичное изменение, если backend отклонил запрос.
      set((state) => ({
        likedPostIds: { ...state.likedPostIds, [postId]: wasLiked },
        posts: state.posts.map((post) =>
          matchesTarget(post, postId)
            ? { ...post, likes: post.likes + (nextLiked ? -1 : 1) }
            : post,
        ),
      }));
    }
  },
  toggleRepost: async (postId) => {
    const wasReposted = Boolean(get().repostedPostIds[postId]);
    const nextReposted = !wasReposted;

    set((state) => ({
      repostedPostIds: { ...state.repostedPostIds, [postId]: nextReposted },
      posts: state.posts.map((post) =>
        matchesTarget(post, postId)
          ? { ...post, reposts: post.reposts + (nextReposted ? 1 : -1) }
          : post,
      ),
    }));

    try {
      const result = await togglePostRepost(postId, nextReposted);
      set((state) => {
        const posts = state.posts
          .map((post) =>
            matchesTarget(post, postId) ? { ...post, reposts: result.reposts } : post,
          )
          .filter((post) => post.id !== result.removedPostId);
        return {
          repostedPostIds: { ...state.repostedPostIds, [postId]: result.isRepostedByMe },
          posts: result.newPost ? [result.newPost, ...posts] : posts,
        };
      });
    } catch {
      // Откатываем оптимистичное изменение, если backend отклонил запрос.
      set((state) => ({
        repostedPostIds: { ...state.repostedPostIds, [postId]: wasReposted },
        posts: state.posts.map((post) =>
          matchesTarget(post, postId)
            ? { ...post, reposts: post.reposts + (nextReposted ? -1 : 1) }
            : post,
        ),
      }));
    }
  },
}));
