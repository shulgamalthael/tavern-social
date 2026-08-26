'use client';

import { useEffect, useRef, useState } from 'react';
import type { GalleryImage } from '@/entities/gallery';
import {
  CommentComposer,
  CommentList,
  selectPostById,
  usePostStore,
  type CommentComposerHandle,
  type ReplyTarget,
} from '@/entities/post';
import { cn } from '@/shared/lib/cn';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './GalleryLightbox.module.scss';

export interface GalleryLightboxProps {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Клик по аватару/имени автора комментария под фото — переход на его
   * профиль (см. `onAuthorClick` в PostCard/CommentList, тот же приём). */
  onAuthorClick?: (authorId: string) => void;
}

/**
 * `ImageLightbox` (без бизнес-логики, shared/ui) + компактная панель
 * реакций/комментариев к фото — тем же `usePostStore`/`useCommentStore`, что
 * и у обычного поста в ленте: фото галереи — это Post с `imageUrl` (см.
 * AGENTS.md), лайк/дизлайк/комментарий к фото — это лайк/дизлайк/комментарий
 * к этому посту, без отдельной системы реакций для галереи. Профиль всегда
 * грузит стену того же пользователя рядом (см. ProfileWidget/UserProfileView),
 * поэтому пост уже есть в сторе к моменту открытия лайтбокса — счётчики и
 * добавленные комментарии остаются синхронными с лентой/стеной сами собой.
 */
export function GalleryLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  onAuthorClick,
}: GalleryLightboxProps) {
  const [isCommentsOpen, setCommentsOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const composerRef = useRef<CommentComposerHandle>(null);
  const toggleLike = usePostStore((state) => state.toggleLike);
  const toggleDislike = usePostStore((state) => state.toggleDislike);

  const image = images[index];
  const postId = image?.postId ?? null;

  const post = usePostStore((state) => (postId ? selectPostById(state, postId) : undefined));
  const isLikedByMe = usePostStore((state) =>
    postId ? (state.likedPostIds[postId] ?? image?.isLikedByMe ?? false) : false,
  );
  const isDislikedByMe = usePostStore((state) =>
    postId ? (state.dislikedPostIds[postId] ?? image?.isDislikedByMe ?? false) : false,
  );

  useEffect(() => {
    if (focusSignal > 0) composerRef.current?.focus();
  }, [focusSignal]);

  if (!image) return null;

  const likes = post?.likes ?? image.likes;
  const dislikes = post?.dislikes ?? image.dislikes;
  const comments = post?.comments ?? image.comments;
  // Как и в PostCard — видно сразу, если ответы уже есть, «Ответить» ниже
  // только фокусирует инпут.
  const showComments = isCommentsOpen || comments > 0;

  return (
    <ImageLightbox
      images={images}
      index={index}
      onIndexChange={(nextIndex) => {
        onIndexChange(nextIndex);
        setCommentsOpen(false);
        setReplyTarget(null);
      }}
      onClose={onClose}
      footer={
        postId && (
          <div className={styles.footer}>
            <div className={styles.actions}>
              <button
                type="button"
                className={cn(styles.reaction, isLikedByMe && styles['reaction--active'])}
                onClick={() => void toggleLike(postId)}
              >
                {isLikedByMe ? 'Кружка поднята' : 'Поднять кружку'} · {likes}
              </button>
              <button
                type="button"
                className={cn(
                  styles.reaction,
                  isDislikedByMe && styles['reaction--active-negative'],
                )}
                onClick={() => void toggleDislike(postId)}
              >
                {isDislikedByMe ? 'Кружка отставлена' : 'Отставить кружку'} · {dislikes}
              </button>
              <button
                type="button"
                className={styles.reaction}
                aria-expanded={showComments}
                onClick={() => {
                  setCommentsOpen(true);
                  setFocusSignal((n) => n + 1);
                }}
              >
                Ответить · {comments}
              </button>
            </div>

            {showComments && (
              <div className={styles.comments}>
                <ScrollArea
                  className={styles['comments__list']}
                  viewportClassName={styles['comments__list-viewport']}
                >
                  <CommentList
                    postId={postId}
                    onReply={(target) => {
                      setReplyTarget(target);
                      setFocusSignal((n) => n + 1);
                    }}
                    onAuthorClick={onAuthorClick}
                  />
                </ScrollArea>
                <CommentComposer
                  ref={composerRef}
                  postId={postId}
                  replyTarget={replyTarget}
                  onCancelReply={() => setReplyTarget(null)}
                />
              </div>
            )}
          </div>
        )
      }
    />
  );
}
