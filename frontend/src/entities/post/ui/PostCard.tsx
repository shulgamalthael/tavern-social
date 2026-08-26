import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { findClickedImageIndex } from '@/shared/lib/find-clicked-image-index';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { IdBadge, IdBadgeGroup } from '@/shared/ui/IdBadge';
import { ImageLightbox } from '@/shared/ui/ImageLightbox';
import type { Post } from '../model/types';
import { CommentComposer, type CommentComposerHandle } from './CommentComposer';
import { CommentList } from './CommentList';
import { LinkPreviewCard } from './LinkPreviewCard';
import styles from './PostCard.module.scss';

export interface ReplyTarget {
  commentId: string;
  author: string;
}

interface LightboxTarget {
  images: string[];
  index: number;
}

export interface PostCardProps {
  post: Post;
  isLiked?: boolean;
  isDisliked?: boolean;
  isReposted?: boolean;
  onToggleLike?: () => void;
  onToggleDislike?: () => void;
  /** Кнопка «Передать дальше» показывается, только когда колбэк передан —
   * тот же принцип, что и у `onDelete`/`onEdit` ниже: вызывающий widget
   * решает видимость (см. `entities/post/lib/can-repost-post.ts` — свой
   * контент репостнуть нельзя, backend всё равно отклонит). */
  onToggleRepost?: () => void;
  /** Клик по аватару/имени автора — переход на его профиль. Вызывается и
   * для автора самого поста, и (отдельно) для автора репостнутого поста —
   * это разные люди. */
  onAuthorClick?: (authorId: string) => void;
  /** Клик по названию группы в шапке поста (см. `post.groupId`) — переход на
   * страницу группы, тем же принципом, что и `onAuthorClick`. */
  onGroupClick?: (groupId: string) => void;
  /** Удаление записи — кнопка «···» показывается только когда вызывающий
   * явно передал колбэк (своя запись, не фото галереи и не репост — см.
   * `widgets/feed`/`widgets/profile`, где решается, у кого он есть). */
  onDelete?: () => void;
  /** Редактирование записи — тот же принцип видимости, что и у `onDelete`
   * (только собственная запись, не карточка репоста). Сама модалка
   * редактирования — feature-уровня (`features/publish-post/ui/
   * EditPostModal`), не рендерится отсюда: `entities/post` не может
   * импортировать `features/*` (направление зависимостей FSD), поэтому
   * вызывающий widget сам решает, что открыть по этому колбэку. */
  onEdit?: () => void;
}

export function PostCard({
  post,
  isLiked = false,
  isDisliked = false,
  isReposted = false,
  onToggleLike,
  onToggleDislike,
  onToggleRepost,
  onAuthorClick,
  onGroupClick,
  onDelete,
  onEdit,
}: PostCardProps) {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser.role === 'admin';
  const [isCommentsOpen, setCommentsOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [lightbox, setLightbox] = useState<LightboxTarget | null>(null);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<CommentComposerHandle>(null);
  // Счётчик, а не boolean — гарантирует, что эффект ниже сработает на КАЖДЫЙ
  // клик «Ответить» (в т. ч. повторный, когда `isCommentsOpen` уже `true` и
  // сам по себе не меняется, см. `focusComposer`).
  const [focusSignal, setFocusSignal] = useState(0);
  // Если у поста уже есть ответы — видно сразу минимум `DEFAULT_COMMENTS_LIMIT`
  // (см. backend `PostsService.listComments`), без клика на «Ответить»; сам
  // клик по «Ответить» ниже только фокусирует инпут, а не разворачивает.
  const showComments = isCommentsOpen || post.comments > 0;
  // `wallOwnerId` пуст для постов группы (взаимоисключающе с `groupId`,
  // см. entities/post/model/types.ts) — без этой проверки `null !== authorId`
  // ошибочно читался бы как «на чужой стене».
  const isOnAnothersWall = Boolean(post.wallOwnerId) && post.wallOwnerId !== post.authorId;
  const { repostOf, groupId } = post;
  const repostGroupId = repostOf?.groupId ?? null;

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  // Фокусирует инпут ответа уже ПОСЛЕ того, как секция комментариев
  // гарантированно смонтирована (если она открывалась этим же кликом) —
  // `setCommentsOpen`/`setFocusSignal` batch'атся в один рендер, эффект
  // срабатывает по его коммиту.
  useEffect(() => {
    if (focusSignal > 0) composerRef.current?.focus();
  }, [focusSignal]);

  const focusComposer = () => {
    setCommentsOpen(true);
    setFocusSignal((n) => n + 1);
  };

  return (
    <Card as="article" className={styles.post}>
      <div className={styles.post__head}>
        <button
          type="button"
          className={styles['post__author-trigger']}
          onClick={() => onAuthorClick?.(post.authorId)}
        >
          <Avatar initials={post.initials} src={post.authorAvatarUrl} />
        </button>
        <div className={styles.post__head_body}>
          <button
            type="button"
            className={styles['post__author-name-trigger']}
            onClick={() => onAuthorClick?.(post.authorId)}
          >
            <span className={styles.post__author}>{post.author}</span>
          </button>
          {isAdmin && (
            <IdBadgeGroup className={styles['post__id-badges']}>
              <IdBadge id={post.authorId} label="Автор" />
              <IdBadge id={post.id} label="Запись" />
            </IdBadgeGroup>
          )}
          <span className={styles.post__meta}>
            {post.meta}
            {groupId && (
              <>
                {' · в группе '}
                <button
                  type="button"
                  className={styles['post__wall-owner-trigger']}
                  onClick={() => onGroupClick?.(groupId)}
                >
                  <span className={styles['post__wall-owner']}>{post.groupName}</span>
                </button>
              </>
            )}
            {!groupId && isOnAnothersWall && (
              <>
                {' · на стене '}
                <span className={styles['post__wall-owner']}>{post.wallOwnerName}</span>
              </>
            )}
          </span>
        </div>
        {(onEdit || onDelete) && (
          <div className={styles['post__menu']} ref={menuRef}>
            <button
              type="button"
              className={styles['post__more-button']}
              aria-label="Ещё"
              aria-expanded={isMenuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ···
            </button>
            {isMenuOpen && (
              <div className={styles['post__menu-popover']}>
                {onEdit && (
                  <button
                    type="button"
                    className={styles['post__menu-item']}
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                  >
                    Редактировать
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className={cn(styles['post__menu-item'], styles['post__menu-item--danger'])}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {post.text && (
        <div
          className={styles.post__text}
          onClick={(event) => {
            const index = findClickedImageIndex(event, post.images);
            if (index >= 0) setLightbox({ images: post.images, index });
          }}
          // Безопасно: `post.text` уже прошёл санитизацию на backend
          // (`common/lib/sanitize-post-content.ts`) перед сохранением — это
          // не сырой пользовательский ввод, отображаемый как есть.
          dangerouslySetInnerHTML={{ __html: post.text }}
        />
      )}

      {post.linkPreviews.map((preview) => (
        <LinkPreviewCard key={preview.url} preview={preview} />
      ))}

      {lightbox && (
        <ImageLightbox
          images={lightbox.images.map((url, index) => ({ id: `${post.id}-${index}`, url }))}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox((state) => (state ? { ...state, index } : state))}
          onClose={() => setLightbox(null)}
        />
      )}

      {repostOf && (
        <div className={styles['post__repost']}>
          <div className={styles['post__repost-head']}>
            <button
              type="button"
              className={styles['post__author-trigger']}
              onClick={() => onAuthorClick?.(repostOf.authorId)}
            >
              <Avatar initials={repostOf.initials} src={repostOf.authorAvatarUrl} size="sm" />
            </button>
            <button
              type="button"
              className={styles['post__author-name-trigger']}
              onClick={() => onAuthorClick?.(repostOf.authorId)}
            >
              <span className={styles['post__author']}>{repostOf.author}</span>
            </button>
            <span className={styles['post__meta']}>
              {repostOf.meta}
              {repostGroupId && (
                <>
                  {' · в группе '}
                  <button
                    type="button"
                    className={styles['post__wall-owner-trigger']}
                    onClick={() => onGroupClick?.(repostGroupId)}
                  >
                    <span className={styles['post__wall-owner']}>{repostOf.groupName}</span>
                  </button>
                </>
              )}
            </span>
          </div>
          {repostOf.text && (
            <div
              className={styles['post__repost-text']}
              onClick={(event) => {
                const index = findClickedImageIndex(event, repostOf.images);
                if (index >= 0) setLightbox({ images: repostOf.images, index });
              }}
              dangerouslySetInnerHTML={{ __html: repostOf.text }}
            />
          )}
          {repostOf.linkPreviews.map((preview) => (
            <LinkPreviewCard key={preview.url} preview={preview} />
          ))}
        </div>
      )}

      <footer className={styles.post__footer}>
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
          aria-expanded={showComments}
          onClick={focusComposer}
        >
          Ответить · {post.comments}
        </button>
        {onToggleRepost && (
          <button
            type="button"
            className={cn(styles.post__reaction, isReposted && styles['post__reaction--active'])}
            onClick={onToggleRepost}
          >
            {isReposted ? 'Передано дальше' : 'Передать дальше'} · {post.reposts}
          </button>
        )}
      </footer>

      {showComments && (
        <div className={styles['post__comments']}>
          {/* `post.id`, а не `post.repostOf?.id` — в отличие от лайка/дизлайка/
           * репоста (см. `onToggleLike`/`onToggleRepost` в шапке виджета,
           * который рендерит эту карточку), комментарий под репостом — это
           * разговор именно здесь, не под оригиналом: иначе он молча
           * всплывал бы и на самом оригинале везде, где тот показан. */}
          <CommentList
            postId={post.id}
            onReply={(target) => {
              setReplyTarget(target);
              setFocusSignal((n) => n + 1);
            }}
            onAuthorClick={onAuthorClick}
          />
          <CommentComposer
            ref={composerRef}
            postId={post.id}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
          />
        </div>
      )}
    </Card>
  );
}
