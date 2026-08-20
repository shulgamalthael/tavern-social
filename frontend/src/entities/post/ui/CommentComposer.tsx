'use client';

import { useState } from 'react';
import { useCurrentUser } from '@/entities/user';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { useCommentStore } from '../model/comment-store';
import styles from './CommentComposer.module.scss';

export interface CommentComposerProps {
  postId: string;
}

export function CommentComposer({ postId }: CommentComposerProps) {
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
      await addComment(postId, draft);
      setDraft('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось отправить ответ');
    } finally {
      setPending(false);
    }
  };

  return (
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
        placeholder="Что скажете?"
      />
      <Button variant="outline" onClick={submit} disabled={isPending}>
        {isPending ? 'Отвечаем…' : 'Ответить'}
      </Button>
      {error && <p className={styles['composer__error']}>{error}</p>}
    </div>
  );
}
