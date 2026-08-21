import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { createPost } from '../api/create-post';
import { deletePost } from '../api/delete-post';
import { getGroupPosts } from '../api/get-group-posts';
import { getPosts } from '../api/get-posts';
import { getWallPosts } from '../api/get-wall-posts';
import { togglePostDislike } from '../api/toggle-post-dislike';
import { togglePostLike } from '../api/toggle-post-like';
import { togglePostRepost } from '../api/toggle-post-repost';
import { updatePost as updatePostAction } from '../api/update-post';
import type { Post } from './types';

interface PostState {
  posts: Post[];
  status: AsyncStatus;
  error: string | null;
  /** Курсор следующей страницы общей ленты — `null` значит «дальше нет» (см.
   * `loadMorePosts`, `shared/lib/use-infinite-scroll`). */
  nextCursor: string | null;
  loadMoreStatus: AsyncStatus;
  likedPostIds: Record<string, boolean>;
  dislikedPostIds: Record<string, boolean>;
  repostedPostIds: Record<string, boolean>;
  /** Пост, для которого сейчас летит запрос реакции (лайк ИЛИ дизлайк — один
   * и тот же лок на оба, они всё равно взаимоисключающие) — защита от гонки
   * при двойном клике/быстрых повторных кликах: пока запрос не завершился,
   * новый `toggleLike`/`toggleDislike` на этот же пост просто игнорируется,
   * а не улетает параллельно (см. `toggleLike`/`toggleDislike` ниже). */
  pendingReactionByPostId: Record<string, boolean>;
  /** Посты конкретной стены — отдельно от общей ленты (см. `loadWallPosts`),
   * тот же паттерн покомпонентных карт, что и `commentsByPostId`. */
  wallPostsByUserId: Record<string, Post[]>;
  wallStatusByUserId: Record<string, AsyncStatus>;
  wallErrorByUserId: Record<string, string | null>;
  wallNextCursorByUserId: Record<string, string | null>;
  wallLoadMoreStatusByUserId: Record<string, AsyncStatus>;
  /** Посты конкретной группы — тот же паттерн покомпонентных карт, что и у
   * `wallPostsByUserId` (см. AGENTS.md §4). */
  groupPostsByGroupId: Record<string, Post[]>;
  groupStatusByGroupId: Record<string, AsyncStatus>;
  groupErrorByGroupId: Record<string, string | null>;
  groupNextCursorByGroupId: Record<string, string | null>;
  groupLoadMoreStatusByGroupId: Record<string, AsyncStatus>;
}

interface PostActions {
  loadPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  loadWallPosts: (userId: string) => Promise<void>;
  loadMoreWallPosts: (userId: string) => Promise<void>;
  loadGroupPosts: (groupId: string) => Promise<void>;
  loadMoreGroupPosts: (groupId: string) => Promise<void>;
  publishPost: (input: {
    text: string;
    images?: File[];
    wallOwnerId?: string;
    groupId?: string;
  }) => Promise<void>;
  /** Редактирование собственного поста — `text`/`images` уже в финальном виде
   * (плейсхолдеры `attachment:N` вместо `blob:`-превью, см.
   * `features/publish-post/ui/PostEditor.tsx`). Патчит пост во всех
   * загруженных списках (`mapEverywhere`), как и остальные мутации ниже. */
  updatePost: (postId: string, input: { text: string; images?: File[] }) => Promise<void>;
  /** Дописывает пост, уже созданный НЕ через `publishPost` — например,
   * автопост при загрузке фото в галерею (см. `entities/gallery`,
   * `widgets/profile/ui/GalleryGrid`). Та же логика дописывания в ленту и
   * (если уже загружена) в стену, что и у `publishPost`, но без повторного
   * запроса на создание — пост уже существует на backend. Это и есть
   * синхронизация галереи с лентой: одна и та же запись появляется сразу
   * везде, где ей место, без отдельного «обновите страницу». */
  receiveNewPost: (post: Post) => void;
  toggleLike: (postId: string) => Promise<void>;
  toggleDislike: (postId: string) => Promise<void>;
  toggleRepost: (postId: string) => Promise<void>;
  /** Удаление собственной записи — везде, где она видна (лента + все уже
   * загруженные стены), тем же приёмом, что и отмена репоста (`filterEverywhere`). */
  removePost: (postId: string) => Promise<void>;
  /** То же самое, но без запроса на удаление — пост уже удалён НЕ через
   * `removePost` (см. `receiveNewPost` — симметричный случай для добавления):
   * удаление фото со страницы галереи (`GalleryGrid`) удаляет и связанный
   * Post на backend самостоятельно, здесь только убираем его из уже
   * загруженного состояния ленты/стен, чтобы карточка не осталась висеть
   * до перезагрузки страницы. */
  removeLocalPost: (postId: string) => void;
}

export type PostStore = PostState & PostActions;

/** Ищет пост по точному id — в общей ленте, потом по всем загруженным
 * стенам. Используется там, где нужен конкретный пост вне контекста
 * репоста (см. `widgets/profile/ui/GalleryLightbox` — лайк/дизлайк/
 * комментарии к фото галереи читают и меняют состояние через тот же
 * `usePostStore`, что и лента/стена, а не заводят свою копию). */
export function selectPostById(state: PostStore, postId: string): Post | undefined {
  return (
    state.posts.find((post) => post.id === postId) ??
    Object.values(state.wallPostsByUserId)
      .flat()
      .find((post) => post.id === postId) ??
    Object.values(state.groupPostsByGroupId)
      .flat()
      .find((post) => post.id === postId)
  );
}

/** Карточка репоста показывает статистику оригинала — поэтому реакция/репост,
 * применённые к его id, должны обновить и её отображение, а не только
 * карточку самого оригинала (см. AGENTS.md, раздел про репосты). */
export function matchesTarget(post: Post, targetId: string): boolean {
  return post.id === targetId || post.repostOf?.id === targetId;
}

/** Применяет `updater` и к общей ленте, и ко всем уже загруженным стенам —
 * один и тот же пост может быть виден одновременно в нескольких местах
 * (экспортируется — тот же приём нужен `comment-store.ts`, чтобы патчить
 * счётчик комментариев и в ленте, и на стене, а не только там, откуда
 * пришёл запрос). */
export function mapEverywhere(
  state: PostState,
  updater: (post: Post) => Post,
): Pick<PostState, 'posts' | 'wallPostsByUserId' | 'groupPostsByGroupId'> {
  return {
    posts: state.posts.map(updater),
    wallPostsByUserId: Object.fromEntries(
      Object.entries(state.wallPostsByUserId).map(([userId, posts]) => [
        userId,
        posts.map(updater),
      ]),
    ),
    groupPostsByGroupId: Object.fromEntries(
      Object.entries(state.groupPostsByGroupId).map(([groupId, posts]) => [
        groupId,
        posts.map(updater),
      ]),
    ),
  };
}

/** То же самое, но с фильтрацией (для отмены репоста — убрать карточку). */
function filterEverywhere(
  state: PostState,
  predicate: (post: Post) => boolean,
): Pick<PostState, 'posts' | 'wallPostsByUserId' | 'groupPostsByGroupId'> {
  return {
    posts: state.posts.filter(predicate),
    wallPostsByUserId: Object.fromEntries(
      Object.entries(state.wallPostsByUserId).map(([userId, posts]) => [
        userId,
        posts.filter(predicate),
      ]),
    ),
    groupPostsByGroupId: Object.fromEntries(
      Object.entries(state.groupPostsByGroupId).map(([groupId, posts]) => [
        groupId,
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
  nextCursor: null,
  loadMoreStatus: 'idle',
  likedPostIds: {},
  dislikedPostIds: {},
  repostedPostIds: {},
  pendingReactionByPostId: {},
  wallPostsByUserId: {},
  wallStatusByUserId: {},
  wallErrorByUserId: {},
  wallNextCursorByUserId: {},
  wallLoadMoreStatusByUserId: {},
  groupPostsByGroupId: {},
  groupStatusByGroupId: {},
  groupErrorByGroupId: {},
  groupNextCursorByGroupId: {},
  groupLoadMoreStatusByGroupId: {},
  loadPosts: async () => {
    set({ status: 'loading', error: null });
    try {
      const { posts, nextCursor, likedPostIds, dislikedPostIds, repostedPostIds } =
        await getPosts();
      set({
        posts,
        nextCursor,
        likedPostIds,
        dislikedPostIds,
        repostedPostIds,
        status: 'success',
        loadMoreStatus: 'idle',
      });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось загрузить ленту',
      });
    }
  },
  loadMorePosts: async () => {
    const { nextCursor, loadMoreStatus, status } = get();
    if (!nextCursor || loadMoreStatus === 'loading' || status !== 'success') return;

    set({ loadMoreStatus: 'loading' });
    try {
      const {
        posts,
        nextCursor: newCursor,
        likedPostIds,
        dislikedPostIds,
        repostedPostIds,
      } = await getPosts(nextCursor);
      set((state) => ({
        posts: [...state.posts, ...posts],
        nextCursor: newCursor,
        loadMoreStatus: 'success',
        likedPostIds: { ...state.likedPostIds, ...likedPostIds },
        dislikedPostIds: { ...state.dislikedPostIds, ...dislikedPostIds },
        repostedPostIds: { ...state.repostedPostIds, ...repostedPostIds },
      }));
    } catch {
      set({ loadMoreStatus: 'error' });
    }
  },
  loadWallPosts: async (userId) => {
    set((state) => ({
      wallStatusByUserId: { ...state.wallStatusByUserId, [userId]: 'loading' },
      wallErrorByUserId: { ...state.wallErrorByUserId, [userId]: null },
    }));
    try {
      const { posts, nextCursor, likedPostIds, dislikedPostIds, repostedPostIds } =
        await getWallPosts(userId);
      set((state) => ({
        wallPostsByUserId: { ...state.wallPostsByUserId, [userId]: posts },
        wallNextCursorByUserId: { ...state.wallNextCursorByUserId, [userId]: nextCursor },
        wallLoadMoreStatusByUserId: { ...state.wallLoadMoreStatusByUserId, [userId]: 'idle' },
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
  loadMoreWallPosts: async (userId) => {
    const { wallNextCursorByUserId, wallLoadMoreStatusByUserId, wallStatusByUserId } = get();
    const cursor = wallNextCursorByUserId[userId];
    if (
      !cursor ||
      wallLoadMoreStatusByUserId[userId] === 'loading' ||
      wallStatusByUserId[userId] !== 'success'
    ) {
      return;
    }

    set((state) => ({
      wallLoadMoreStatusByUserId: { ...state.wallLoadMoreStatusByUserId, [userId]: 'loading' },
    }));
    try {
      const { posts, nextCursor, likedPostIds, dislikedPostIds, repostedPostIds } =
        await getWallPosts(userId, cursor);
      set((state) => ({
        wallPostsByUserId: {
          ...state.wallPostsByUserId,
          [userId]: [...(state.wallPostsByUserId[userId] ?? []), ...posts],
        },
        wallNextCursorByUserId: { ...state.wallNextCursorByUserId, [userId]: nextCursor },
        wallLoadMoreStatusByUserId: { ...state.wallLoadMoreStatusByUserId, [userId]: 'success' },
        likedPostIds: { ...state.likedPostIds, ...likedPostIds },
        dislikedPostIds: { ...state.dislikedPostIds, ...dislikedPostIds },
        repostedPostIds: { ...state.repostedPostIds, ...repostedPostIds },
      }));
    } catch {
      set((state) => ({
        wallLoadMoreStatusByUserId: { ...state.wallLoadMoreStatusByUserId, [userId]: 'error' },
      }));
    }
  },
  loadGroupPosts: async (groupId) => {
    set((state) => ({
      groupStatusByGroupId: { ...state.groupStatusByGroupId, [groupId]: 'loading' },
      groupErrorByGroupId: { ...state.groupErrorByGroupId, [groupId]: null },
    }));
    try {
      const { posts, nextCursor, likedPostIds, dislikedPostIds, repostedPostIds } =
        await getGroupPosts(groupId);
      set((state) => ({
        groupPostsByGroupId: { ...state.groupPostsByGroupId, [groupId]: posts },
        groupNextCursorByGroupId: { ...state.groupNextCursorByGroupId, [groupId]: nextCursor },
        groupLoadMoreStatusByGroupId: { ...state.groupLoadMoreStatusByGroupId, [groupId]: 'idle' },
        groupStatusByGroupId: { ...state.groupStatusByGroupId, [groupId]: 'success' },
        likedPostIds: { ...state.likedPostIds, ...likedPostIds },
        dislikedPostIds: { ...state.dislikedPostIds, ...dislikedPostIds },
        repostedPostIds: { ...state.repostedPostIds, ...repostedPostIds },
      }));
    } catch (error) {
      set((state) => ({
        groupStatusByGroupId: { ...state.groupStatusByGroupId, [groupId]: 'error' },
        groupErrorByGroupId: {
          ...state.groupErrorByGroupId,
          [groupId]: error instanceof Error ? error.message : 'Не удалось загрузить ленту группы',
        },
      }));
    }
  },
  loadMoreGroupPosts: async (groupId) => {
    const { groupNextCursorByGroupId, groupLoadMoreStatusByGroupId, groupStatusByGroupId } = get();
    const cursor = groupNextCursorByGroupId[groupId];
    if (
      !cursor ||
      groupLoadMoreStatusByGroupId[groupId] === 'loading' ||
      groupStatusByGroupId[groupId] !== 'success'
    ) {
      return;
    }

    set((state) => ({
      groupLoadMoreStatusByGroupId: { ...state.groupLoadMoreStatusByGroupId, [groupId]: 'loading' },
    }));
    try {
      const { posts, nextCursor, likedPostIds, dislikedPostIds, repostedPostIds } =
        await getGroupPosts(groupId, cursor);
      set((state) => ({
        groupPostsByGroupId: {
          ...state.groupPostsByGroupId,
          [groupId]: [...(state.groupPostsByGroupId[groupId] ?? []), ...posts],
        },
        groupNextCursorByGroupId: { ...state.groupNextCursorByGroupId, [groupId]: nextCursor },
        groupLoadMoreStatusByGroupId: {
          ...state.groupLoadMoreStatusByGroupId,
          [groupId]: 'success',
        },
        likedPostIds: { ...state.likedPostIds, ...likedPostIds },
        dislikedPostIds: { ...state.dislikedPostIds, ...dislikedPostIds },
        repostedPostIds: { ...state.repostedPostIds, ...repostedPostIds },
      }));
    } catch {
      set((state) => ({
        groupLoadMoreStatusByGroupId: { ...state.groupLoadMoreStatusByGroupId, [groupId]: 'error' },
      }));
    }
  },
  publishPost: async ({ text, images, wallOwnerId, groupId }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const post = await createPost(trimmed, images ?? [], wallOwnerId, groupId);
    set((state) => ({
      // Групповой пост не попадает в общую ленту (см. PostsService.listFeed
      // на backend) — дописываем его только в ленту группы, если она уже
      // загружена.
      posts: groupId ? state.posts : [post, ...state.posts],
      // Дописываем и в стену, если она уже была открыта/загружена — иначе
      // свежая запись появится там только после следующего loadWallPosts.
      wallPostsByUserId:
        wallOwnerId && state.wallPostsByUserId[wallOwnerId]
          ? {
              ...state.wallPostsByUserId,
              [wallOwnerId]: [post, ...state.wallPostsByUserId[wallOwnerId]],
            }
          : state.wallPostsByUserId,
      groupPostsByGroupId:
        groupId && state.groupPostsByGroupId[groupId]
          ? {
              ...state.groupPostsByGroupId,
              [groupId]: [post, ...state.groupPostsByGroupId[groupId]],
            }
          : state.groupPostsByGroupId,
    }));
  },
  updatePost: async (postId, { text, images }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const post = await updatePostAction(postId, trimmed, images ?? []);
    set((state) => mapEverywhere(state, (existing) => (existing.id === postId ? post : existing)));
  },
  receiveNewPost: (post) => {
    set((state) => ({
      posts: [post, ...state.posts],
      wallPostsByUserId:
        post.wallOwnerId && state.wallPostsByUserId[post.wallOwnerId]
          ? {
              ...state.wallPostsByUserId,
              [post.wallOwnerId]: [post, ...state.wallPostsByUserId[post.wallOwnerId]],
            }
          : state.wallPostsByUserId,
    }));
  },
  toggleLike: async (postId) => {
    if (get().pendingReactionByPostId[postId]) return;

    const wasLiked = Boolean(get().likedPostIds[postId]);
    const nextLiked = !wasLiked;

    // Оптимистичное обновление — сразу отражаем ожидаемый результат
    // (включая мгновенное снятие дизлайка, если он был — реакции
    // взаимоисключающие), затем сверяемся с ответом backend.
    set((state) => ({
      pendingReactionByPostId: { ...state.pendingReactionByPostId, [postId]: true },
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
    } finally {
      set((state) => ({
        pendingReactionByPostId: { ...state.pendingReactionByPostId, [postId]: false },
      }));
    }
  },
  toggleDislike: async (postId) => {
    if (get().pendingReactionByPostId[postId]) return;

    const wasDisliked = Boolean(get().dislikedPostIds[postId]);
    const nextDisliked = !wasDisliked;

    set((state) => ({
      pendingReactionByPostId: { ...state.pendingReactionByPostId, [postId]: true },
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
    } finally {
      set((state) => ({
        pendingReactionByPostId: { ...state.pendingReactionByPostId, [postId]: false },
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
  removePost: async (postId) => {
    await deletePost(postId);
    set((state) => filterEverywhere(state, (post) => post.id !== postId));
  },
  removeLocalPost: (postId) => {
    set((state) => filterEverywhere(state, (post) => post.id !== postId));
  },
}));
