'use client';

import { type FormEvent, useState } from 'react';
import { useThreadStore } from '@/entities/thread';
import { Button } from '@/shared/ui/Button';
import styles from './MessageComposer.module.scss';

export interface MessageComposerProps {
  threadId: string;
}

export function MessageComposer({ threadId }: MessageComposerProps) {
  const sendMessage = useThreadStore((state) => state.sendMessage);
  const [draft, setDraft] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    void sendMessage(threadId, draft);
    setDraft('');
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      <input
        className={styles['composer__input']}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Подсесть к разговору…"
      />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
