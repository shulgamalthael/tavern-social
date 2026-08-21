import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { createComment as createCommentAction } from '../api/create-comment';
import { deleteComment as deleteCommentAction } from '../api/delete-comment';
import { getComments } from '../api/get-comments';
import type { Comment } from './comment-types';
import { mapEverywhere, matchesTarget, usePostStore } from './post-store';

interface CommentState {
  commentsByPostId: Record<string, Comment[]>;
  statusByPostId: Record<string, AsyncStatus>;
  errorByPostId: Record<string, string | null>;
  /** Курсор следующей страницы комментариев конкретного поста — `null`
   * значит «дальше нет» (см. `loadMoreComments`, тот же паттерн, что и у
   * `usePostStore.nextCursor`). */
  nextCursorByPostId: Record<string, string | null>;
  loadMoreStatusByPostId: Record<string, AsyncStatus>;
}

interface CommentActions {
  loadComments: (postId: string) => Promise<void>;
  loadMoreComments: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string, parentId?: string) => Promise<void>;
  /** Удаление собственного комментария — верхнеуровневый комментарий
   * убирает и свои ответы (см. `PostsService.removeComment` на backend,
   * тот же каскад). */
  removeComment: (postId: string, commentId: string) => Promise<void>;
}

export type CommentStore = CommentState & CommentActions;

/**
 * Комментарии открываются по одному посту за раз (раскрытая карточка в
 * ленте/на стене) — общий store, а не локальный useState, потому что тот же
 * пост может быть виден одновременно и в ленте, и на стене профиля.
 */
export const useCommentStore = create<CommentStore>((set, get) => ({
  commentsByPostId: {},
  statusByPostId: {},
  errorByPostId: {},
  nextCursorByPostId: {},
  loadMoreStatusByPostId: {},
  loadComments: async (postId) => {
    set((state) => ({
      statusByPostId: { ...state.statusByPostId, [postId]: 'loading' },
      errorByPostId: { ...state.errorByPostId, [postId]: null },
    }));
    try {
      const { comments, nextCursor } = await getComments(postId);
      set((state) => ({
        commentsByPostId: { ...state.commentsByPostId, [postId]: comments },
        nextCursorByPostId: { ...state.nextCursorByPostId, [postId]: nextCursor },
        loadMoreStatusByPostId: { ...state.loadMoreStatusByPostId, [postId]: 'idle' },
        statusByPostId: { ...state.statusByPostId, [postId]: 'success' },
      }));
    } catch (error) {
      set((state) => ({
        statusByPostId: { ...state.statusByPostId, [postId]: 'error' },
        errorByPostId: {
          ...state.errorByPostId,
          [postId]: error instanceof Error ? error.message : 'Не удалось загрузить ответы',
        },
      }));
    }
  },
  loadMoreComments: async (postId) => {
    const { nextCursorByPostId, loadMoreStatusByPostId, statusByPostId } = get();
    const cursor = nextCursorByPostId[postId];
    if (
      !cursor ||
      loadMoreStatusByPostId[postId] === 'loading' ||
      statusByPostId[postId] !== 'success'
    ) {
      return;
    }

    set((state) => ({
      loadMoreStatusByPostId: { ...state.loadMoreStatusByPostId, [postId]: 'loading' },
    }));
    try {
      const { comments, nextCursor } = await getComments(postId, cursor);
      set((state) => ({
        commentsByPostId: {
          ...state.commentsByPostId,
          [postId]: [...(state.commentsByPostId[postId] ?? []), ...comments],
        },
        nextCursorByPostId: { ...state.nextCursorByPostId, [postId]: nextCursor },
        loadMoreStatusByPostId: { ...state.loadMoreStatusByPostId, [postId]: 'success' },
      }));
    } catch {
      set((state) => ({
        loadMoreStatusByPostId: { ...state.loadMoreStatusByPostId, [postId]: 'error' },
      }));
    }
  },
  addComment: async (postId, text, parentId) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment = await createCommentAction(postId, trimmed, parentId);
    set((state) => ({
      commentsByPostId: {
        ...state.commentsByPostId,
        [postId]: [...(state.commentsByPostId[postId] ?? []), comment],
      },
    }));
    // Счётчик «Ответить · N» живёт на самом посте (entities/post) — обновляем
    // его здесь напрямую, а не через отдельный round-trip за лентой. И в
    // ленте, и на всех уже загруженных стенах разом (mapEverywhere) — один
    // и тот же пост виден в обоих местах одновременно (например, комментарий
    // к фото в лайтбоксе галереи должен обновить счётчик и на стене того же
    // профиля, где эта галерея открыта).
    usePostStore.setState((state) =>
      mapEverywhere(state, (post) =>
        matchesTarget(post, postId) ? { ...post, comments: post.comments + 1 } : post,
      ),
    );
  },
  removeComment: async (postId, commentId) => {
    await deleteCommentAction(postId, commentId);

    const existing = get().commentsByPostId[postId] ?? [];
    const removedIds = new Set(
      existing
        .filter((comment) => comment.id === commentId || comment.parentId === commentId)
        .map((comment) => comment.id),
    );
    set((state) => ({
      commentsByPostId: {
        ...state.commentsByPostId,
        [postId]: (state.commentsByPostId[postId] ?? []).filter(
          (comment) => !removedIds.has(comment.id),
        ),
      },
    }));

    usePostStore.setState((state) =>
      mapEverywhere(state, (post) =>
        matchesTarget(post, postId)
          ? { ...post, comments: Math.max(0, post.comments - removedIds.size) }
          : post,
      ),
    );
  },
}));
