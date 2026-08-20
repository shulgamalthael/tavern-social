'use client';

import { useState } from 'react';
import { usePostStore } from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import styles from './PostComposer.module.scss';

export interface PostComposerProps {
  /** `feed` — полный композер с чипами, `wall` — однострочная запись на стене. */
  variant?: 'feed' | 'wall';
}

/**
 * Публикация поста нужна и в ленте, и на стене профиля — один feature-компонент
 * с двумя визуальными вариантами вместо дублирования логики черновика/сабмита.
 */
export function PostComposer({ variant = 'feed' }: PostComposerProps) {
  const { currentUser } = useCurrentUser();
  const publishPost = usePostStore((state) => state.publishPost);
  const [draft, setDraft] = useState('');
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!draft.trim() || isPending) return;
    setPending(true);
    setError(null);
    try {
      await publishPost({ text: draft });
      setDraft('');
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось опубликовать запись',
      );
    } finally {
      setPending(false);
    }
  };

  if (variant === 'wall') {
    return (
      <Card className={cn(styles.composer, styles['composer--wall'])}>
        <Avatar initials={currentUser.initials} />
        <input
          className={styles['composer__input']}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Записать на своей стене…"
        />
        <Button onClick={submit} disabled={isPending}>
          Записать
        </Button>
        {error && <p className={styles['composer__error']}>{error}</p>}
      </Card>
    );
  }

  return (
    <Card className={styles.composer}>
      <div className={styles.composer__top}>
        <Avatar initials={currentUser.initials} />
        <textarea
          className={styles['composer__textarea']}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="О чём расскажешь залу?"
        />
      </div>
      {error && <p className={styles['composer__error']}>{error}</p>}
      <div className={styles.composer__actions}>
        <Button variant="chip">Фото</Button>
        <Button variant="chip">Сбор</Button>
        <Button variant="chip">Опрос</Button>
        <Button className={styles['composer__submit']} onClick={submit} disabled={isPending}>
          {isPending ? 'Публикуем…' : 'Рассказать'}
        </Button>
      </div>
    </Card>
  );
}
