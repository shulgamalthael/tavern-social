'use client';

import { useState } from 'react';
import { useCurrentUser } from '@/entities/user';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { useCommentStore } from '../model/comment-store';
import type { ReplyTarget } from './PostCard';
import styles from './CommentComposer.module.scss';

export interface CommentComposerProps {
  postId: string;
  replyTarget: ReplyTarget | null;
  onCancelReply: () => void;
}

export function CommentComposer({ postId, replyTarget, onCancelReply }: CommentComposerProps) {
  const { currentUser } = useCurrentUser();
  const addComment = useCommentStore((state) => state.addComment);
  const [draft, setDraft] = useState('');
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!draft.trim() || isPending) return;
    setPending(true);
    setError(null);
    try {
      await addComment(postId, draft, replyTarget?.commentId);
      setDraft('');
      onCancelReply();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить ответ');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles['composer-wrap']}>
      {replyTarget && (
        <div className={styles['composer__reply-hint']}>
          Ответ для <span className={styles['composer__reply-author']}>{replyTarget.author}</span>
          <button
            type="button"
            className={styles['composer__reply-cancel']}
            onClick={onCancelReply}
          >
            Отменить
          </button>
        </div>
      )}
      <div className={styles.composer}>
        <Avatar initials={currentUser.initials} size="sm" />
        <input
          className={styles['composer__input']}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={replyTarget ? `Ответ для ${replyTarget.author}…` : 'Что скажете?'}
        />
        <Button variant="outline" onClick={submit} disabled={isPending}>
          {isPending ? 'Отвечаем…' : 'Ответить'}
        </Button>
        {error && <p className={styles['composer__error']}>{error}</p>}
      </div>
    </div>
  );
}
