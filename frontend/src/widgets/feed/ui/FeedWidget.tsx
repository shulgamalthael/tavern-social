'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { selectFeedAds, type SelectedAd } from '@/entities/advertising';
import {
  canBoostPost,
  canDeletePost,
  canRepostPost,
  PostCard,
  PostCardSkeleton,
  usePostStore,
  type Post,
} from '@/entities/post';
import { NativeAdCard, selectNativeAds, type NativeAdFeedItem } from '@/entities/native-ad';
import { useCurrentUser } from '@/entities/user';
import { PostBoostModal } from '@/features/boost-post';
import { EditPostModal, PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { StoriesTray } from '@/features/stories';
import { cn } from '@/shared/lib/cn';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { FEED_TAB_KIND, FEED_TABS, type FeedTab } from '../config/feed-tabs';
import { FeedAdSlot } from './FeedAdSlot';
import { PopularPostsCard } from './PopularPostsCard';
import styles from './FeedWidget.module.scss';

const FEED_SKELETON_COUNT = 4;
// Ровно столько слотов в сайдбарах ленты — 1 в правом + 2 в левом (см.
// разметку ниже), не с запасом "на будущее": каждый слот получает свой
// индекс из ответа `selectFeedAds`, лишние кампании сверх этого числа этому
// запросу просто не нужны.
const FEED_AD_SLOT_COUNT = 3;

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
  const [boostingPost, setBoostingPost] = useState<Post | null>(null);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMorePosts());

  // Нативная реклама в ленте (Creator Monetization Phase 2,
  // AI_PLATFORM_ROADMAP.md §80) — НЕ часть `PostState`/`Post[]` (см.
  // `entities/native-ad`'s комментарий на backend `NativeAdFeedService`):
  // отдельная разрежённая карта "после какого поста что вставить", которую
  // просто читаем при рендере, не трогая store лайков/репостов/комментариев.
  // `fetchedPostIdsRef` — какие id уже запрашивали, чтобы `loadMorePosts` не
  // переспрашивал рекламу для уже известных постов заново на каждом рендере.
  const [nativeAdsByPostId, setNativeAdsByPostId] = useState<Record<string, NativeAdFeedItem>>({});
  const fetchedPostIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newIds = posts.map((post) => post.id).filter((id) => !fetchedPostIdsRef.current.has(id));
    if (newIds.length === 0) return;

    // `fetchedPostIdsRef` отмечается ТОЛЬКО после реального ответа, не до
    // запроса — react-hooks StrictMode в dev-режиме монтирует эффект дважды
    // (mount → cleanup → mount); если бы id помечался как "запрошен" сразу,
    // отменённый первый запуск потерял бы свой результат (`cancelled`), а
    // второй запуск увидел бы id уже "запрошенным" и не переспросил бы —
    // реклама молча никогда бы не появлялась. Живой баг, найденный именно так.
    let cancelled = false;
    void selectNativeAds(newIds).then((ads) => {
      if (cancelled) return;
      newIds.forEach((id) => fetchedPostIdsRef.current.add(id));
      setNativeAdsByPostId((prev) => ({ ...prev, ...ads }));
    });
    return () => {
      cancelled = true;
    };
  }, [posts]);

  // Баннеры сайдбаров ленты (`FeedAdSlot`) — независимый от постов запрос,
  // один раз на монтирование виджета: три слота получают свои креативы по
  // индексу ответа (лучшая ставка — индекс 0), см. `FeedAdSlot`'s
  // комментарий про сам движок отбора.
  const [feedAds, setFeedAds] = useState<SelectedAd[]>([]);
  useEffect(() => {
    let cancelled = false;
    void selectFeedAds(FEED_AD_SLOT_COUNT).then((ads) => {
      if (!cancelled) setFeedAds(ads);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePosts = useMemo(() => {
    const kind = FEED_TAB_KIND[activeTab];
    return kind ? posts.filter((post) => post.kind === kind) : posts;
  }, [activeTab, posts]);

  return (
    <SectionContainer className={styles.feed}>
      <div className={styles['feed__column']}>
        <StoriesTray />
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
            const ad = nativeAdsByPostId[post.id];
            return (
              <Fragment key={post.id}>
                <PostCard
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
                  // Та же оговорка, что у `onEdit` — у карточки репоста нет
                  // собственного текста, продвигать там нечего, только сам
                  // оригинал (открыть его и продвинуть отдельно).
                  onBoost={
                    canBoostPost(post, currentUser.id) && !post.repostOf
                      ? () => setBoostingPost(post)
                      : undefined
                  }
                />
                {ad && <NativeAdCard ad={ad} />}
              </Fragment>
            );
          })}

        {postsStatus === 'success' && <div ref={sentinelRef} aria-hidden="true" />}
        {loadMoreStatus === 'loading' && <PostCardSkeleton />}
      </div>

      {editingPost && <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} />}

      {boostingPost && (
        <PostBoostModal
          post={boostingPost}
          onClose={() => setBoostingPost(null)}
          onBoosted={() => {
            setBoostingPost(null);
            void loadPosts();
          }}
        />
      )}

      <aside className={cn(styles['feed__sidebar'], styles['feed__sidebar--right'])}>
        <FeedAdSlot ad={feedAds[0]} />

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

      <aside className={cn(styles['feed__sidebar'], styles['feed__sidebar--left'])}>
        <FeedAdSlot ad={feedAds[1]} />
        <FeedAdSlot ad={feedAds[2]} size="compact" />
        {postsStatus === 'success' && (
          <PopularPostsCard posts={posts} onAuthorClick={goToUserProfile} />
        )}
      </aside>
    </SectionContainer>
  );
}
