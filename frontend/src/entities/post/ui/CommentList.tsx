'use client';

import { useEffect } from 'react';
import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { canDeleteComment } from '../lib/can-delete-comment';
import type { Comment } from '../model/comment-types';
import { useCommentStore } from '../model/comment-store';
import type { ReplyTarget } from './PostCard';
import styles from './CommentList.module.scss';

export interface CommentListProps {
  postId: string;
  onReply: (target: ReplyTarget) => void;
  /** Клик по аватару/имени автора комментария — переход на его профиль (см.
   * `onAuthorClick` в PostCard, тот же приём). */
  onAuthorClick?: (authorId: string) => void;
}

/** Группирует плоский список в верхний уровень + ответы под ним — один
 * уровень вложенности (см. AGENTS.md backend, раздел про комментарии). */
function groupByParent(comments: Comment[]): {
  top: Comment[];
  repliesByParentId: Map<string, Comment[]>;
} {
  const top: Comment[] = [];
  const repliesByParentId = new Map<string, Comment[]>();

  for (const comment of comments) {
    if (!comment.parentId) {
      top.push(comment);
      continue;
    }
    const replies = repliesByParentId.get(comment.parentId) ?? [];
    replies.push(comment);
    repliesByParentId.set(comment.parentId, replies);
  }

  return { top, repliesByParentId };
}

function CommentRow({
  comment,
  isReply,
  onReply,
  onDelete,
  onAuthorClick,
}: {
  comment: Comment;
  /** Строка — ответ, а не комментарий верхнего уровня — рисует «локоть»,
   * соединяющий её аватар с общей вертикальной линией треда (см.
   * `.comment-list__row--reply` в CommentList.module.scss). */
  isReply?: boolean;
  onReply?: () => void;
  onDelete?: () => void;
  onAuthorClick?: (authorId: string) => void;
}) {
  return (
    <div className={cn(styles['comment-list__row'], isReply && styles['comment-list__row--reply'])}>
      <button
        type="button"
        className={styles['comment-list__avatar-trigger']}
        onClick={() => onAuthorClick?.(comment.authorId)}
      >
        <Avatar initials={comment.initials} src={comment.avatarUrl} size="sm" />
      </button>
      <div className={styles['comment-list__body']}>
        <div className={styles['comment-list__head']}>
          <button
            type="button"
            className={styles['comment-list__author-trigger']}
            onClick={() => onAuthorClick?.(comment.authorId)}
          >
            <span className={styles['comment-list__author']}>{comment.author}</span>
          </button>
          <span className={styles['comment-list__meta']}>{comment.meta}</span>
        </div>
        <p className={styles['comment-list__text']}>{comment.text}</p>
        {(onReply || onDelete) && (
          <div className={styles['comment-list__row-actions']}>
            {onReply && (
              <button
                type="button"
                className={styles['comment-list__reply-button']}
                onClick={onReply}
              >
                Ответить
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className={styles['comment-list__delete-button']}
                onClick={onDelete}
              >
                Удалить
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentList({ postId, onReply, onAuthorClick }: CommentListProps) {
  const { currentUser } = useCurrentUser();
  const comments = useCommentStore((state) => state.commentsByPostId[postId]);
  const status = useCommentStore((state) => state.statusByPostId[postId] ?? 'idle');
  const error = useCommentStore((state) => state.errorByPostId[postId] ?? null);
  const loadComments = useCommentStore((state) => state.loadComments);
  const nextCursor = useCommentStore((state) => state.nextCursorByPostId[postId] ?? null);
  const loadMoreStatus = useCommentStore((state) => state.loadMoreStatusByPostId[postId] ?? 'idle');
  const loadMoreComments = useCommentStore((state) => state.loadMoreComments);
  const removeComment = useCommentStore((state) => state.removeComment);

  useEffect(() => {
    if (status === 'idle') void loadComments(postId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим один раз при первом раскрытии карточки
  }, [postId]);

  if (status === 'loading' || status === 'idle') {
    return <Loader label="Загружаем ответы…" className={styles['comment-list__loader']} />;
  }

  if (status === 'error') {
    return <ErrorState message={error} onRetry={() => loadComments(postId)} />;
  }

  if (!comments || comments.length === 0) {
    return <p className={styles['comment-list__empty']}>Пока никто не ответил — начните первым.</p>;
  }

  const { top, repliesByParentId } = groupByParent(comments);

  return (
    <>
      <ul className={styles['comment-list']}>
        {top.map((comment) => {
          const replies = repliesByParentId.get(comment.id) ?? [];
          return (
            <li key={comment.id} className={styles['comment-list__item']}>
              <CommentRow
                comment={comment}
                onReply={() => onReply({ commentId: comment.id, author: comment.author })}
                onDelete={
                  canDeleteComment(comment, currentUser.id)
                    ? () => void removeComment(postId, comment.id)
                    : undefined
                }
                onAuthorClick={onAuthorClick}
              />
              {replies.length > 0 && (
                <ul className={styles['comment-list__replies']}>
                  {replies.map((reply) => (
                    <li key={reply.id} className={styles['comment-list__item']}>
                      <CommentRow
                        comment={reply}
                        isReply
                        onDelete={
                          canDeleteComment(reply, currentUser.id)
                            ? () => void removeComment(postId, reply.id)
                            : undefined
                        }
                        onAuthorClick={onAuthorClick}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <button
          type="button"
          className={styles['comment-list__more']}
          disabled={loadMoreStatus === 'loading'}
          onClick={() => void loadMoreComments(postId)}
        >
          {loadMoreStatus === 'loading' ? 'Загружаем…' : 'Показать ещё'}
        </button>
      )}
    </>
  );
}
