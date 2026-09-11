'use client';

import { useMemo, useState } from 'react';
import { getFriends } from '@/entities/friend';
import { selectPostById, usePostStore, useShareModalStore } from '@/entities/post';
import { getOrCreateDirectThread, useThreadStore } from '@/entities/thread';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { stripHtmlText } from '@/shared/lib/strip-html-text';
import { Avatar } from '@/shared/ui/Avatar';
import { CheckIcon } from '@/shared/ui/icons';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Loader } from '@/shared/ui/Loader';
import { Modal } from '@/shared/ui/Modal';
import styles from './SharePostModal.module.scss';

interface ShareTarget {
  /** Тред для уже существующих диалогов (1:1 или групповых), id пользователя
   * для друга, с которым переписки ещё нет — различается по `kind`, см.
   * `handleSend`. */
  kind: 'thread' | 'friend';
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

/**
 * Смонтирована один раз в `app/home-app.tsx` (тот же приём, что
 * `NotificationToaster`) — читает `sharingPostId` из `useShareModalStore`,
 * которую пишет кнопка «Переслать» на любой `PostCard` (лента, чужая/своя
 * стена, сообщества). Сама модалка/загрузка данных — только пока открыта
 * (дочерний компонент монтируется условно), чтобы не держать подписку на
 * `usePostStore`/тред-стор и не грузить друзей, пока никто не жмёт «Переслать».
 */
export function SharePostModal() {
  const sharingPostId = useShareModalStore((state) => state.sharingPostId);
  const closeShareModal = useShareModalStore((state) => state.closeShareModal);

  if (!sharingPostId) return null;

  return <SharePostModalContent postId={sharingPostId} onClose={closeShareModal} />;
}

function SharePostModalContent({ postId, onClose }: { postId: string; onClose: () => void }) {
  const post = usePostStore((state) => selectPostById(state, postId));
  const threads = useThreadStore((state) => state.threads);
  const sendMessage = useThreadStore((state) => state.sendMessage);
  const ensureThread = useThreadStore((state) => state.ensureThread);
  const { status: friendsStatus, data: friendsPage } = useAsyncData(getFriends);

  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo<ShareTarget[]>(() => {
    const threadTargets: ShareTarget[] = threads.map((thread) => ({
      kind: 'thread',
      id: thread.id,
      name: thread.name,
      initials: thread.initials,
      avatarUrl: thread.avatarUrl,
    }));

    // Друзья, с которыми уже есть личный (не групповой) диалог, уже покрыты
    // строкой выше — не дублируем тем же человеком дважды в списке.
    const directParticipantIds = new Set(
      threads
        .filter((thread) => !thread.isGroup)
        .map((thread) => thread.participants[0]?.id)
        .filter((id): id is string => Boolean(id)),
    );

    const friendTargets: ShareTarget[] = (friendsPage?.friends ?? [])
      .filter((friend) => !directParticipantIds.has(friend.id))
      .map((friend) => ({
        kind: 'friend',
        id: friend.id,
        name: friend.name,
        initials: friend.initials,
        avatarUrl: friend.avatarUrl,
      }));

    return [...threadTargets, ...friendTargets];
  }, [threads, friendsPage]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return targets;
    return targets.filter((target) => target.name.toLowerCase().includes(trimmed));
  }, [targets, query]);

  const handleSend = async (target: ShareTarget) => {
    setPendingId(target.id);
    setError(null);
    try {
      const threadId =
        target.kind === 'thread'
          ? target.id
          : await getOrCreateDirectThread(target.id).then((thread) => {
              ensureThread(thread);
              return thread.id;
            });
      await sendMessage(threadId, '', [], undefined, postId);
      setSentIds((prev) => new Set(prev).add(target.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переслать запись');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Modal onClose={onClose} label="Переслать запись" className={styles.share}>
      <h2 className={styles['share__title']}>Переслать запись</h2>

      {post && (
        <div className={styles['share__preview']}>
          <Avatar initials={post.initials} src={post.authorAvatarUrl} size="sm" />
          <div className={styles['share__preview-body']}>
            <span className={styles['share__preview-author']}>{post.author}</span>
            {post.text && (
              <span className={styles['share__preview-text']}>{stripHtmlText(post.text)}</span>
            )}
          </div>
          {post.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- маленькая миниатюра превью, не оптимизируемый Next Image-контент
            <img src={post.images[0]} alt="" className={styles['share__preview-image']} />
          )}
        </div>
      )}

      <input
        autoFocus
        type="search"
        className={styles['share__input']}
        placeholder="Найти друга или диалог…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {error && <p className={styles['share__error']}>{error}</p>}

      {friendsStatus === 'loading' && <Loader label="Загружаем список…" />}

      {friendsStatus !== 'loading' && filtered.length === 0 && (
        <EmptyState
          className={styles['share__state']}
          title="Ничего не нашли"
          description="Попробуйте другое имя."
        />
      )}

      {friendsStatus !== 'loading' && filtered.length > 0 && (
        <div className={styles['share__list']}>
          {filtered.map((target) => {
            const isSent = sentIds.has(target.id);
            return (
              <button
                key={`${target.kind}-${target.id}`}
                type="button"
                className={styles['share__row']}
                disabled={pendingId === target.id || isSent}
                onClick={() => void handleSend(target)}
              >
                <Avatar initials={target.initials} src={target.avatarUrl} size="sm" />
                <span className={styles['share__row-name']}>{target.name}</span>
                {isSent && (
                  <span className={styles['share__row-sent']}>
                    <CheckIcon className={styles['share__row-sent-icon']} />
                    Отправлено
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
