'use client';

import { useState } from 'react';
import { unfollowUser } from '@/entities/follow';
import { useCurrentUser } from '@/entities/user';
import { useNavigationStore } from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { SubscribersListModal } from './SubscribersListModal';
import styles from './ProfileFollowStats.module.scss';

export interface ProfileFollowStatsProps {
  userId: string;
  followersCount: number;
  followingCount: number;
  /** Только для закрытого приватного профиля (§103, `UserProfileView`) —
   * третий, тоже некликабельный показатель рядом с подписчиками/подписками.
   * В обычном сценарии (полный доступ) не передаётся: счётчик друзей там —
   * своя соседняя карточка с превью-сеткой (`ProfileFriendsCard`). */
  friendsCount?: number;
  /** `false` — только для приватного профиля без доступа (§103): цифры
   * видны, но не кликабельны (сами списки всё равно вернут 403 с backend,
   * см. `UsersController.getFollowers`/`getFollowing`). По умолчанию
   * `true` — обычное интерактивное поведение с модалкой. */
  interactive?: boolean;
}

/**
 * Компактная строка «N подписчиков · M подписок» под именем в шапке профиля
 * — используется и на своей странице (`ProfileWidget`), и на чужой
 * (`UserProfileView`), тот же компонент для обеих (как `ProfileFriendsCard`).
 * Каждая половина кликабельна — открывает `SubscribersListModal` с реальной
 * курсорной подгрузкой (§85: подписчики ничем не ограничены, в отличие от
 * друзей). Отписаться прямо из списка можно только из СВОЕЙ вкладки
 * «Подписки» (`isOwn` вычисляется тем же приёмом, что и в
 * `ProfileFriendsCard`, — убрать чужого подписчика эта задача не просит).
 */
export function ProfileFollowStats({
  userId,
  followersCount,
  followingCount,
  friendsCount,
  interactive = true,
}: ProfileFollowStatsProps) {
  const [modalKind, setModalKind] = useState<'followers' | 'following' | null>(null);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const { currentUser } = useCurrentUser();
  const isOwn = userId === currentUser.id;

  return (
    <>
      <div className={styles['follow-stats']}>
        {interactive ? (
          <button
            type="button"
            className={styles['follow-stats__item']}
            onClick={() => setModalKind('followers')}
          >
            <strong>{followersCount.toLocaleString('ru-RU')}</strong> подписчиков
          </button>
        ) : (
          <span className={cn(styles['follow-stats__item'], styles['follow-stats__item--static'])}>
            <strong>{followersCount.toLocaleString('ru-RU')}</strong> подписчиков
          </span>
        )}
        {interactive ? (
          <button
            type="button"
            className={styles['follow-stats__item']}
            onClick={() => setModalKind('following')}
          >
            <strong>{followingCount.toLocaleString('ru-RU')}</strong> подписок
          </button>
        ) : (
          <span className={cn(styles['follow-stats__item'], styles['follow-stats__item--static'])}>
            <strong>{followingCount.toLocaleString('ru-RU')}</strong> подписок
          </span>
        )}
        {friendsCount !== undefined && (
          <span className={cn(styles['follow-stats__item'], styles['follow-stats__item--static'])}>
            <strong>{friendsCount.toLocaleString('ru-RU')}</strong> друзей
          </span>
        )}
      </div>

      {interactive && modalKind && (
        <SubscribersListModal
          userId={userId}
          kind={modalKind}
          onClose={() => setModalKind(null)}
          onSelectSubscriber={(id) => {
            setModalKind(null);
            goToUserProfile(id);
          }}
          onUnsubscribe={
            isOwn && modalKind === 'following'
              ? async (id) => {
                  await unfollowUser(id);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
