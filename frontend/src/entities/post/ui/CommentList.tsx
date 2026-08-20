'use client';

import { useEffect } from 'react';
import { Avatar } from '@/shared/ui/Avatar';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import type { Comment } from '../model/comment-types';
import { useCommentStore } from '../model/comment-store';
import type { ReplyTarget } from './PostCard';
import styles from './CommentList.module.scss';

export interface CommentListProps {
  postId: string;
  onReply: (target: ReplyTarget) => void;
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

function CommentRow({ comment, onReply }: { comment: Comment; onReply?: () => void }) {
  return (
    <div className={styles['comment-list__row']}>
      <Avatar initials={comment.initials} size="sm" />
      <div className={styles['comment-list__body']}>
        <div className={styles['comment-list__head']}>
          <span className={styles['comment-list__author']}>{comment.author}</span>
          <span className={styles['comment-list__meta']}>{comment.meta}</span>
        </div>
        <p className={styles['comment-list__text']}>{comment.text}</p>
        {onReply && (
          <button type="button" className={styles['comment-list__reply-button']} onClick={onReply}>
            Ответить
          </button>
        )}
      </div>
    </div>
  );
}

export function CommentList({ postId, onReply }: CommentListProps) {
  const comments = useCommentStore((state) => state.commentsByPostId[postId]);
  const status = useCommentStore((state) => state.statusByPostId[postId] ?? 'idle');
  const error = useCommentStore((state) => state.errorByPostId[postId] ?? null);
  const loadComments = useCommentStore((state) => state.loadComments);

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
    <ul className={styles['comment-list']}>
      {top.map((comment) => {
        const replies = repliesByParentId.get(comment.id) ?? [];
        return (
          <li key={comment.id} className={styles['comment-list__item']}>
            <CommentRow
              comment={comment}
              onReply={() => onReply({ commentId: comment.id, author: comment.author })}
            />
            {replies.length > 0 && (
              <ul className={styles['comment-list__replies']}>
                {replies.map((reply) => (
                  <li key={reply.id} className={styles['comment-list__item']}>
                    <CommentRow comment={reply} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
