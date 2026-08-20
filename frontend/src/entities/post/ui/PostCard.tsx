import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import type { Post } from '../model/types';
import { CommentComposer } from './CommentComposer';
import { CommentList } from './CommentList';
import styles from './PostCard.module.scss';

export interface ReplyTarget {
  commentId: string;
  author: string;
}

export interface PostCardProps {
  post: Post;
  /** `feed` — полная карточка с реакциями, `wall` — сжатая версия для стены профиля. */
  variant?: 'feed' | 'wall';
  isLiked?: boolean;
  isDisliked?: boolean;
  isReposted?: boolean;
  onToggleLike?: () => void;
  onToggleDislike?: () => void;
  onToggleRepost?: () => void;
}

export function PostCard({
  post,
  variant = 'feed',
  isLiked = false,
  isDisliked = false,
  isReposted = false,
  onToggleLike,
  onToggleDislike,
  onToggleRepost,
}: PostCardProps) {
  const [isCommentsOpen, setCommentsOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  // Лайк/дизлайк/ответ/репост на карточке репоста всегда применяются к оригиналу.
  const interactionPostId = post.repostOf?.id ?? post.id;
  const isOnAnothersWall = post.wallOwnerId !== post.authorId;

  return (
    <Card as="article" className={styles.post}>
      <div className={styles.post__head}>
        <Avatar initials={post.initials} />
        <div className={styles.post__head_body}>
          <span className={styles.post__author}>{post.author}</span>
          <span className={styles.post__meta}>
            {post.meta}
            {isOnAnothersWall && (
              <>
                {' · на стене '}
                <span className={styles['post__wall-owner']}>{post.wallOwnerName}</span>
              </>
            )}
          </span>
        </div>
        {variant === 'feed' && (
          <button type="button" className={styles['post__more-button']} aria-label="Ещё">
            ···
          </button>
        )}
      </div>

      {post.text && <p className={styles.post__text}>{post.text}</p>}

      {post.repostOf && (
        <div className={styles['post__repost']}>
          <div className={styles['post__repost-head']}>
            <Avatar initials={post.repostOf.initials} size="sm" />
            <span className={styles['post__author']}>{post.repostOf.author}</span>
            <span className={styles['post__meta']}>{post.repostOf.meta}</span>
          </div>
          <p className={styles['post__repost-text']}>{post.repostOf.text}</p>
        </div>
      )}

      <footer className={styles.post__footer}>
        {variant === 'feed' ? (
          <>
            <button
              type="button"
              className={cn(styles.post__reaction, isLiked && styles['post__reaction--active'])}
              onClick={onToggleLike}
            >
              {isLiked ? 'Кружка поднята' : 'Поднять кружку'} · {post.likes}
            </button>
            <button
              type="button"
              className={cn(
                styles.post__reaction,
                isDisliked && styles['post__reaction--active-negative'],
              )}
              onClick={onToggleDislike}
            >
              {isDisliked ? 'Кружка отставлена' : 'Отставить кружку'} · {post.dislikes}
            </button>
            <button
              type="button"
              className={styles.post__reaction}
              aria-expanded={isCommentsOpen}
              onClick={() => setCommentsOpen((open) => !open)}
            >
              Ответить · {post.comments}
            </button>
            <button
              type="button"
              className={cn(styles.post__reaction, isReposted && styles['post__reaction--active'])}
              onClick={onToggleRepost}
            >
              {isReposted ? 'Передано дальше' : 'Передать дальше'} · {post.reposts}
            </button>
            <span className={styles['post__views']}>{post.views}</span>
          </>
        ) : (
          <>
            <span className={styles['post__meta']}>Кружек: {post.likes}</span>
            <span className={styles['post__meta']}>Ответов: {post.comments}</span>
          </>
        )}
      </footer>

      {variant === 'feed' && isCommentsOpen && (
        <div className={styles['post__comments']}>
          <CommentList postId={interactionPostId} onReply={setReplyTarget} />
          <CommentComposer
            postId={interactionPostId}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
          />
        </div>
      )}
    </Card>
  );
}
