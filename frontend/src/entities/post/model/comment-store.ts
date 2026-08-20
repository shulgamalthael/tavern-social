import { create } from 'zustand';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { createComment as createCommentAction } from '../api/create-comment';
import { getComments } from '../api/get-comments';
import type { Comment } from './comment-types';
import { matchesTarget, usePostStore } from './post-store';

interface CommentState {
  commentsByPostId: Record<string, Comment[]>;
  statusByPostId: Record<string, AsyncStatus>;
  errorByPostId: Record<string, string | null>;
}

interface CommentActions {
  loadComments: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
}

export type CommentStore = CommentState & CommentActions;

/**
 * Комментарии открываются по одному посту за раз (раскрытая карточка в
 * ленте/на стене) — общий store, а не локальный useState, потому что тот же
 * пост может быть виден одновременно и в ленте, и на стене профиля.
 */
export const useCommentStore = create<CommentStore>((set) => ({
  commentsByPostId: {},
  statusByPostId: {},
  errorByPostId: {},
  loadComments: async (postId) => {
    set((state) => ({
      statusByPostId: { ...state.statusByPostId, [postId]: 'loading' },
      errorByPostId: { ...state.errorByPostId, [postId]: null },
    }));
    try {
      const comments = await getComments(postId);
      set((state) => ({
        commentsByPostId: { ...state.commentsByPostId, [postId]: comments },
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
  addComment: async (postId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment = await createCommentAction(postId, trimmed);
    set((state) => ({
      commentsByPostId: {
        ...state.commentsByPostId,
        [postId]: [...(state.commentsByPostId[postId] ?? []), comment],
      },
    }));
    // Счётчик «Ответить · N» живёт на самом посте (entities/post) — обновляем
    // его здесь напрямую, а не через отдельный round-trip за лентой.
    usePostStore.setState((state) => ({
      posts: state.posts.map((post) =>
        matchesTarget(post, postId) ? { ...post, comments: post.comments + 1 } : post,
      ),
    }));
  },
}));
