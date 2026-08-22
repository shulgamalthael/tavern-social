'use client';

import { useEffect, useState } from 'react';
import { useGroupStore } from '@/entities/group';
import {
  canDeletePost,
  canRepostPost,
  PostCard,
  PostCardSkeleton,
  usePostStore,
  type Post,
} from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
import { GroupMembershipControl } from '@/features/group-membership';
import { GroupEditForm, GroupJoinRequestsPanel, GroupMembersList } from '@/features/manage-group';
import { EditPostModal, PostComposer } from '@/features/publish-post';
import { useNavigationStore } from '@/features/section-navigation';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './GroupPageView.module.scss';

export interface GroupPageViewProps {
  groupId: string;
}

const FEED_SKELETON_COUNT = 3;

/**
 * Страница конкретной группы — по структуре `UserProfileView` (обложка/
 * аватар/название вверху, сайдбар + основная колонка с композером и лентой
 * ниже), см. AGENTS.md/план по группам. Приватная группа без доступа не
 * показывает ленту/участников — вместо них CTA вступления
 * (`GroupMembershipControl`), backend уже сам не отдаёт этот контент,
 * `canViewContent` здесь только решает, что рисовать.
 */
export function GroupPageView({ groupId }: GroupPageViewProps) {
  const { currentUser } = useCurrentUser();
  const goToGroup = useNavigationStore((state) => state.goToGroup);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const group = useGroupStore((state) => state.groupsById[groupId]);
  const status = useGroupStore((state) => state.groupStatusById[groupId] ?? 'idle');
  const error = useGroupStore((state) => state.groupErrorById[groupId] ?? null);
  const loadGroup = useGroupStore((state) => state.loadGroup);

  const groupPosts = usePostStore((state) => state.groupPostsByGroupId[groupId]) ?? [];
  const feedStatus = usePostStore((state) => state.groupStatusByGroupId[groupId] ?? 'idle');
  const feedError = usePostStore((state) => state.groupErrorByGroupId[groupId] ?? null);
  const loadGroupPosts = usePostStore((state) => state.loadGroupPosts);
  const feedNextCursor = usePostStore((state) => state.groupNextCursorByGroupId[groupId] ?? null);
  const feedLoadMoreStatus = usePostStore(
    (state) => state.groupLoadMoreStatusByGroupId[groupId] ?? 'idle',
  );
  const loadMoreGroupPosts = usePostStore((state) => state.loadMoreGroupPosts);
  const likedPostIds = usePostStore((state) => state.likedPostIds);
  const dislikedPostIds = usePostStore((state) => state.dislikedPostIds);
  const repostedPostIds = usePostStore((state) => state.repostedPostIds);
  const toggleLike = usePostStore((state) => state.toggleLike);
  const toggleDislike = usePostStore((state) => state.toggleDislike);
  const toggleRepost = usePostStore((state) => state.toggleRepost);
  const removePost = usePostStore((state) => state.removePost);

  const [isEditing, setEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const feedSentinelRef = useInfiniteScroll(feedNextCursor, () => void loadMoreGroupPosts(groupId));

  useEffect(() => {
    void loadGroup(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим один раз при открытии страницы группы
  }, [groupId]);

  useEffect(() => {
    if (group?.canViewContent) void loadGroupPosts(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- грузим ленту один раз, как только известно, что доступ есть
  }, [groupId, group?.canViewContent]);

  if (status === 'loading' || status === 'idle') {
    return (
      <SectionContainer>
        <Loader label="Загружаем группу…" />
      </SectionContainer>
    );
  }

  if (status === 'error' || !group) {
    return (
      <SectionContainer>
        <ErrorState message={error} onRetry={() => void loadGroup(groupId)} />
      </SectionContainer>
    );
  }

  if (isEditing) {
    return (
      <SectionContainer narrow>
        <GroupEditForm mode="edit" group={group} onDone={() => setEditing(false)} />
      </SectionContainer>
    );
  }

  const isOwner = group.currentUserRole === 'owner';
  const canPost = group.currentUserRole !== null;

  return (
    <SectionContainer>
      <section className={styles['group-page__card']}>
        {group.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- обложка группы, не оптимизируемый Next Image-контент
          <img
            src={group.coverUrl}
            alt=""
            className={styles['group-page__cover']}
            style={{
              display: 'block',
              height: 'clamp(120px, 22vw, 190px)',
              width: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <MediaPlaceholder
            label="обложка группы · 1600×400"
            height="clamp(120px, 22vw, 190px)"
            flush
            className={styles['group-page__cover']}
          />
        )}
        <div className={styles['group-page__top']}>
          <Avatar
            initials={group.name.slice(0, 2).toUpperCase()}
            src={group.avatarUrl}
            size="xl"
            bordered
          />
          <div className={styles['group-page__titles']}>
            <span className={styles['group-page__name']}>{group.name}</span>
            <span className={styles['group-page__subtitle']}>
              {group.type === 'open' ? 'Открытая группа' : 'Приватная группа'} ·{' '}
              {group.membersCount}{' '}
              {pluralizeRu(group.membersCount, ['участник', 'участника', 'участников'])}
            </span>
          </div>
          <div className={styles['group-page__actions']}>
            <GroupMembershipControl group={group} />
            {isOwner && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Править группу
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className={styles['group-page__grid']}>
        <div className={styles['group-page__side']}>
          <Card>
            <h2 className={styles['group-page__card-title']}>О группе</h2>
            {group.description ? (
              <p className={styles['group-page__about']}>{group.description}</p>
            ) : (
              <EmptyState title="Пока нет описания" />
            )}
          </Card>

          {group.canViewContent && (
            <Card>
              <h2 className={styles['group-page__card-title']}>Участники</h2>
              <GroupMembersList
                groupId={groupId}
                canManage={isOwner}
                onMemberClick={goToUserProfile}
              />
            </Card>
          )}

          {isOwner && group.type === 'private' && (
            <Card>
              <GroupJoinRequestsPanel groupId={groupId} />
            </Card>
          )}
        </div>

        <div className={styles['group-page__feed']}>
          {!group.canViewContent && (
            <EmptyState
              title="Это приватная группа. Для просмотра контента необходимо вступить в группу."
              action={<GroupMembershipControl group={group} />}
            />
          )}

          {group.canViewContent && (
            <>
              {canPost && <PostComposer variant="group" groupId={groupId} />}
              {!canPost && (
                <EmptyState
                  title="Чтобы публиковать здесь, нужно вступить в группу"
                  description="Записи в группе видят все, у кого есть доступ к её ленте."
                />
              )}

              {feedStatus === 'loading' &&
                Array.from({ length: FEED_SKELETON_COUNT }, (_, index) => (
                  <PostCardSkeleton key={index} />
                ))}
              {feedStatus === 'error' && (
                <ErrorState message={feedError} onRetry={() => void loadGroupPosts(groupId)} />
              )}
              {feedStatus === 'success' && groupPosts.length === 0 && (
                <EmptyState
                  title="В группе пока нет записей"
                  description="Первая запись появится здесь, как только кто-то из участников её опубликует."
                />
              )}
              {feedStatus === 'success' &&
                groupPosts.map((post) => {
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
                        canRepostPost(post, currentUser.id)
                          ? () => toggleRepost(targetId)
                          : undefined
                      }
                      onAuthorClick={goToUserProfile}
                      onGroupClick={goToGroup}
                      onDelete={
                        canDeletePost(post, currentUser.id)
                          ? () =>
                              void (post.repostOf ? toggleRepost(targetId) : removePost(post.id))
                          : undefined
                      }
                      onEdit={
                        canDeletePost(post, currentUser.id) && !post.repostOf
                          ? () => setEditingPost(post)
                          : undefined
                      }
                    />
                  );
                })}

              {feedStatus === 'success' && groupPosts.length > 0 && (
                <div ref={feedSentinelRef} aria-hidden="true" />
              )}
              {feedLoadMoreStatus === 'loading' && <PostCardSkeleton />}
            </>
          )}
        </div>
      </div>

      {editingPost && <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} />}
    </SectionContainer>
  );
}
