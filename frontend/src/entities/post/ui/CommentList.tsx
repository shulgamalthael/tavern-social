'use client';

import { useEffect } from 'react';
import { Avatar } from '@/shared/ui/Avatar';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { useCommentStore } from '../model/comment-store';
import styles from './CommentList.module.scss';

export interface CommentListProps {
  postId: string;
}

export function CommentList({ postId }: CommentListProps) {
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

  return (
    <ul className={styles['comment-list']}>
      {comments.map((comment) => (
        <li key={comment.id} className={styles['comment-list__item']}>
          <Avatar initials={comment.initials} size="sm" />
          <div className={styles['comment-list__body']}>
            <div className={styles['comment-list__head']}>
              <span className={styles['comment-list__author']}>{comment.author}</span>
              <span className={styles['comment-list__meta']}>{comment.meta}</span>
            </div>
            <p className={styles['comment-list__text']}>{comment.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
