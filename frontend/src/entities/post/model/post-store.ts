import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { createPost } from '../api/create-post';
import { getPosts } from '../api/get-posts';
import { getWallPosts } from '../api/get-wall-posts';
import { togglePostDislike } from '../api/toggle-post-dislike';
import { togglePostLike } from '../api/toggle-post-like';
import { togglePostRepost } from '../api/toggle-post-repost';
import type { Post } from './types';

interface PostState {
  posts: Post[];
  status: AsyncStatus;
  error: string | null;
  likedPostIds: Record<string, boolean>;
  dislikedPostIds: Record<string, boolean>;
  repostedPostIds: Record<string, boolean>;
  /** Посты конкретной стены — отдельно от общей ленты (см. `loadWallPosts`),
   * тот же паттерн покомпонентных карт, что и `commentsByPostId`. */
  wallPostsByUserId: Record<string, Post[]>;
  wallStatusByUserId: Record<string, AsyncStatus>;
  wallErrorByUserId: Record<string, string | null>;
}

interface PostActions {
  loadPosts: () => Promise<void>;
  loadWallPosts: (userId: string) => Promise<void>;
  publishPost: (input: { text: string; wallOwnerId?: string }) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  toggleDislike: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
}

export type PostStore = PostState & PostActions;

/** Карточка репоста показывает статистику оригинала — поэтому реакция/репост,
 * применённые к его id, должны обновить и её отображение, а не только
 * карточку самого оригинала (см. AGENTS.md, раздел про репосты). */
export function matchesTarget(post: Post, targetId: string): boolean {
  return post.id === targetId || post.repostOf?.id === targetId;
}

/** Применяет `updater` и к общей ленте, и ко всем уже загруженным стенам —
 * один и тот же пост может быть виден одновременно в нескольких местах. */
function mapEverywhere(
  state: PostState,
  updater: (post: Post) => Post,
): Pick<PostState, 'posts' | 'wallPostsByUserId'> {
  return {
    posts: state.posts.map(updater),
    wallPostsByUserId: Object.fromEntries(
      Object.entries(state.wallPostsByUserId).map(([userId, posts]) => [
        userId,
        posts.map(updater),
      ]),
    ),
  };
}

/** То же самое, но с фильтрацией (для отмены репоста — убрать карточку). */
function filterEverywhere(
  state: PostState,
  predicate: (post: Post) => boolean,
): Pick<PostState, 'posts' | 'wallPostsByUserId'> {
  return {
    posts: state.posts.filter(predicate),
    wallPostsByUserId: Object.fromEntries(
      Object.entries(state.wallPostsByUserId).map(([userId, posts]) => [
        userId,
        posts.filter(predicate),
      ]),
    ),
  };
}

/**
 * Посты нужны и ленте, и стене профиля — общий store вместо дублирования
 * состояния в нескольких виджетах. Общая лента загружается один раз при
 * старте приложения (см. `app/home-app.tsx`); стена конкретного пользователя
 * — по требованию, при открытии его страницы (см. `widgets/profile`).
 */
export const usePostStore = create<PostStore>((set, get) => ({
  posts: [],
  status: 'idle',
  error: null,
  likedPostIds: {},
  dislikedPostIds: {},
  repostedPostIds: {},
  wallPostsByUserId: {},
  wallStatusByUserId: {},
  wallErrorByUserId: {},
  loadPosts: async () => {
    set({ status: 'loading', error: null });
    try {
      const { posts, likedPostIds, dislikedPostIds, repostedPostIds } = await getPosts();
      set({ posts, likedPostIds, dislikedPostIds, repostedPostIds, status: 'success' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить ленту',
      });
    }
  },
  loadWallPosts: async (userId) => {
    set((state) => ({
      wallStatusByUserId: { ...state.wallStatusByUserId, [userId]: 'loading' },
      wallErrorByUserId: { ...state.wallErrorByUserId, [userId]: null },
    }));
    try {
      const { posts, likedPostIds, dislikedPostIds, repostedPostIds } = await getWallPosts(userId);
      set((state) => ({
        wallPostsByUserId: { ...state.wallPostsByUserId, [userId]: posts },
        wallStatusByUserId: { ...state.wallStatusByUserId, [userId]: 'success' },
        likedPostIds: { ...state.likedPostIds, ...likedPostIds },
        dislikedPostIds: { ...state.dislikedPostIds, ...dislikedPostIds },
        repostedPostIds: { ...state.repostedPostIds, ...repostedPostIds },
      }));
    } catch (error) {
      set((state) => ({
        wallStatusByUserId: { ...state.wallStatusByUserId, [userId]: 'error' },
        wallErrorByUserId: {
          ...state.wallErrorByUserId,
          [userId]: error instanceof Error ? error.message : 'Не удалось загрузить стену',
        },
      }));
    }
  },
  publishPost: async ({ text, wallOwnerId }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const post = await createPost(trimmed, wallOwnerId);
    set((state) => ({
      posts: [post, ...state.posts],
      // Дописываем и в стену, если она уже была открыта/загружена — иначе
      // свежая запись появится там только после следующего loadWallPosts.
      wallPostsByUserId:
        wallOwnerId && state.wallPostsByUserId[wallOwnerId]
          ? {
              ...state.wallPostsByUserId,
              [wallOwnerId]: [post, ...state.wallPostsByUserId[wallOwnerId]],
            }
          : state.wallPostsByUserId,
    }));
  },
  toggleLike: async (postId) => {
    const wasLiked = Boolean(get().likedPostIds[postId]);
    const nextLiked = !wasLiked;

    // Оптимистичное обновление — сразу отражаем ожидаемый результат
    // (включая мгновенное снятие дизлайка, если он был — реакции
    // взаимоисключающие), затем сверяемся с ответом backend.
    set((state) => ({
      likedPostIds: { ...state.likedPostIds, [postId]: nextLiked },
      dislikedPostIds: nextLiked
        ? { ...state.dislikedPostIds, [postId]: false }
        : state.dislikedPostIds,
      ...mapEverywhere(state, (post) =>
        matchesTarget(post, postId) ? { ...post, likes: post.likes + (nextLiked ? 1 : -1) } : post,
      ),
    }));

    try {
      const result = await togglePostLike(postId, nextLiked);
      set((state) => ({
        likedPostIds: { ...state.likedPostIds, [postId]: result.isLikedByMe },
        dislikedPostIds: { ...state.dislikedPostIds, [postId]: result.isDislikedByMe },
        ...mapEverywhere(state, (post) =>
          matchesTarget(post, postId)
            ? { ...post, likes: result.likes, dislikes: result.dislikes }
            : post,
        ),
      }));
    } catch {
      // Откатываем оптимистичное изменение, если backend отклонил запрос.
      set((state) => ({
        likedPostIds: { ...state.likedPostIds, [postId]: wasLiked },
        ...mapEverywhere(state, (post) =>
          matchesTarget(post, postId)
            ? { ...post, likes: post.likes + (nextLiked ? -1 : 1) }
            : post,
        ),
      }));
    }
  },
  toggleDislike: async (postId) => {
    const wasDisliked = Boolean(get().dislikedPostIds[postId]);
    const nextDisliked = !wasDisliked;

    set((state) => ({
      dislikedPostIds: { ...state.dislikedPostIds, [postId]: nextDisliked },
      likedPostIds: nextDisliked ? { ...state.likedPostIds, [postId]: false } : state.likedPostIds,
      ...mapEverywhere(state, (post) =>
        matchesTarget(post, postId)
          ? { ...post, dislikes: post.dislikes + (nextDisliked ? 1 : -1) }
          : post,
      ),
    }));

    try {
      const result = await togglePostDislike(postId, nextDisliked);
      set((state) => ({
        dislikedPostIds: { ...state.dislikedPostIds, [postId]: result.isDislikedByMe },
        likedPostIds: { ...state.likedPostIds, [postId]: result.isLikedByMe },
        ...mapEverywhere(state, (post) =>
          matchesTarget(post, postId)
            ? { ...post, likes: result.likes, dislikes: result.dislikes }
            : post,
        ),
      }));
    } catch {
      set((state) => ({
        dislikedPostIds: { ...state.dislikedPostIds, [postId]: wasDisliked },
        ...mapEverywhere(state, (post) =>
          matchesTarget(post, postId)
            ? { ...post, dislikes: post.dislikes + (nextDisliked ? -1 : 1) }
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
      ...mapEverywhere(state, (post) =>
        matchesTarget(post, postId)
          ? { ...post, reposts: post.reposts + (nextReposted ? 1 : -1) }
          : post,
      ),
    }));

    try {
      const result = await togglePostRepost(postId, nextReposted);
      set((state) => {
        const updated = mapEverywhere(state, (post) =>
          matchesTarget(post, postId) ? { ...post, reposts: result.reposts } : post,
        );
        const filtered = result.removedPostId
          ? filterEverywhere({ ...state, ...updated }, (post) => post.id !== result.removedPostId)
          : updated;
        return {
          repostedPostIds: { ...state.repostedPostIds, [postId]: result.isRepostedByMe },
          posts: result.newPost ? [result.newPost, ...filtered.posts] : filtered.posts,
          wallPostsByUserId: filtered.wallPostsByUserId,
        };
      });
    } catch {
      // Откатываем оптимистичное изменение, если backend отклонил запрос.
      set((state) => ({
        repostedPostIds: { ...state.repostedPostIds, [postId]: wasReposted },
        ...mapEverywhere(state, (post) =>
          matchesTarget(post, postId)
            ? { ...post, reposts: post.reposts + (nextReposted ? -1 : 1) }
            : post,
        ),
      }));
    }
  },
}));
