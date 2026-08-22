'use client';

import { useMemo, useState } from 'react';
import {
  canDeletePost,
  canRepostPost,
  PostCard,
  PostCardSkeleton,
  usePostStore,
  type Post,
} from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
import { EditPostModal, PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { FEED_TAB_KIND, FEED_TABS, type FeedTab } from '../config/feed-tabs';
import styles from './FeedWidget.module.scss';

const FEED_SKELETON_COUNT = 4;

export function FeedWidget() {
  const { currentUser } = useCurrentUser();
  const posts = usePostStore((state) => state.posts);
  const postsStatus = usePostStore((state) => state.status);
  const postsError = usePostStore((state) => state.error);
  const loadPosts = usePostStore((state) => state.loadPosts);
  const nextCursor = usePostStore((state) => state.nextCursor);
  const loadMoreStatus = usePostStore((state) => state.loadMoreStatus);
  const loadMorePosts = usePostStore((state) => state.loadMorePosts);
  const likedPostIds = usePostStore((state) => state.likedPostIds);
  const dislikedPostIds = usePostStore((state) => state.dislikedPostIds);
  const repostedPostIds = usePostStore((state) => state.repostedPostIds);
  const toggleLike = usePostStore((state) => state.toggleLike);
  const toggleDislike = usePostStore((state) => state.toggleDislike);
  const toggleRepost = usePostStore((state) => state.toggleRepost);
  const removePost = usePostStore((state) => state.removePost);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const [activeTab, setActiveTab] = useState<FeedTab>(FEED_TABS[0]);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMorePosts());

  const visiblePosts = useMemo(() => {
    const kind = FEED_TAB_KIND[activeTab];
    return kind ? posts.filter((post) => post.kind === kind) : posts;
  }, [activeTab, posts]);

  return (
    <SectionContainer className={styles.feed}>
      <div className={styles['feed__column']}>
        <div className={styles['feed__hero']}>
          <div>
            <h1 className={styles['feed__title']}>
              Добрый вечер, {currentUser.name.split(' ')[0]}
            </h1>
            <p className={styles['feed__subtitle']}>Здесь появится всё, что происходит в зале.</p>
          </div>
        </div>

        <PostComposer />

        <div className={styles['feed__tabs']} role="tablist">
          {FEED_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={cn(styles['feed__tab'], activeTab === tab && styles['feed__tab--active'])}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
          {postsStatus === 'success' && (
            <span className={styles['feed__tabs-count']}>{visiblePosts.length} записей</span>
          )}
        </div>

        {postsStatus === 'loading' &&
          Array.from({ length: FEED_SKELETON_COUNT }, (_, index) => (
            <PostCardSkeleton key={index} />
          ))}
        {postsStatus === 'error' && <ErrorState message={postsError} onRetry={loadPosts} />}

        {postsStatus === 'success' && posts.length === 0 && (
          <EmptyState
            title="В зале пока тихо"
            description="Никто ещё ничего не написал. Расскажите первым, о чём думаете — выше есть место для записи."
          />
        )}

        {postsStatus === 'success' && posts.length > 0 && visiblePosts.length === 0 && (
          <EmptyState
            title="По этому фильтру ничего нет"
            description="В выбранной вкладке пока нет записей."
            action={
              <Button variant="outline" onClick={() => setActiveTab(FEED_TABS[0])}>
                Сбросить фильтр
              </Button>
            }
          />
        )}

        {postsStatus === 'success' &&
          visiblePosts.map((post) => {
            const targetId = post.repostOf?.id ?? post.id;
            return (
              <PostCard
                key={post.id}
                post={post}
                isLiked={Boolean(likedPostIds[targetId])}
                isDisliked={Boolean(dislikedPostIds[targetId])}
                isReposted={Boolean(repostedPostIds[targetId])}
                onToggleLike={() => toggleLike(targetId)}
                onToggleDislike={() => toggleDislike(targetId)}
                onToggleRepost={
                  canRepostPost(post, currentUser.id) ? () => toggleRepost(targetId) : undefined
                }
                onAuthorClick={goToUserProfile}
                onDelete={
                  canDeletePost(post, currentUser.id)
                    ? // Карточка репоста — это отдельная запись поверх оригинала, у её
                      // удаления уже есть свой путь («Передать дальше» → `toggleRepost`),
                      // который корректно декрементирует repostsCount оригинала;
                      // `removePost` (обычный `DELETE /posts/:id`) для репоста не годится
                      // — не знает о счётчике оригинала.
                      () => void (post.repostOf ? toggleRepost(targetId) : removePost(post.id))
                    : undefined
                }
                // Карточка репоста — обёртка без собственного содержимого
                // (`post.repostOf` задан, `post.text` всегда пустой) —
                // редактировать в ней нечего, только сам оригинал.
                onEdit={
                  canDeletePost(post, currentUser.id) && !post.repostOf
                    ? () => setEditingPost(post)
                    : undefined
                }
              />
            );
          })}

        {postsStatus === 'success' && <div ref={sentinelRef} aria-hidden="true" />}
        {loadMoreStatus === 'loading' && <PostCardSkeleton />}
      </div>

      {editingPost && <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} />}

      <aside className={styles['feed__sidebar']}>
        <Card>
          <h2 className={styles['feed__card-title']}>Сейчас в зале</h2>
          <EmptyState
            title="Пока никого не видно"
            description="Мы ещё не умеем показывать, кто сейчас в зале."
          />
        </Card>

        <Card>
          <h2 className={styles['feed__card-title']}>Ближайшие сборы</h2>
          <EmptyState
            title="Сборов пока нет"
            description="Здесь появятся ближайшие события зала."
          />
        </Card>

        <Card>
          <h2 className={styles['feed__card-title']}>Доска объявлений</h2>
          <EmptyState
            title="Объявлений пока нет"
            description="Здесь появятся записки от других гостей."
          />
        </Card>
      </aside>
    </SectionContainer>
  );
}
