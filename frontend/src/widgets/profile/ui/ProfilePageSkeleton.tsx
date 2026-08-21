import { PostCardSkeleton } from '@/entities/post';
import { Card } from '@/shared/ui/Card';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { Skeleton } from '@/shared/ui/Skeleton';
import friendsStyles from './ProfileFriendsCard.module.scss';
import styles from './ProfileWidget.module.scss';

const WALL_SKELETON_COUNT = 3;
const GALLERY_SKELETON_COUNT = 6;
const FRIENDS_SKELETON_COUNT = 6;

/**
 * Заглушка всей страницы профиля на время первой загрузки (только у чужого
 * профиля — `UserProfileView` грузит данные асинхронно целиком; своя
 * страница знает `currentUser` сразу и грузит только стену, см.
 * `ProfileWidget`). Переиспользует классы `ProfileWidget.module.scss`, чтобы
 * форма точно совпадала с реальной страницей.
 */
export function ProfilePageSkeleton() {
  return (
    <SectionContainer>
      <section className={styles['profile__card']}>
        <Skeleton width="100%" height="clamp(120px, 22vw, 190px)" radius={0} />
        <div className={styles['profile__top']}>
          <Skeleton
            width="clamp(76px, 13vw, 104px)"
            height="clamp(76px, 13vw, 104px)"
            radius="50%"
          />
          <div className={styles['profile__titles']}>
            <Skeleton width="45%" height={20} />
            <Skeleton width="65%" height={14} />
          </div>
          <div className={styles['profile__actions']}>
            <Skeleton width={110} height={34} radius={9} />
            <Skeleton width={150} height={34} radius={9} />
          </div>
        </div>
      </section>

      <div className={styles['profile__grid']}>
        <div className={styles['profile__side']}>
          <Card>
            <Skeleton width="30%" height={15} className={styles['profile__card-title']} />
            <div className={styles['profile__about']}>
              <Skeleton width="100%" height={13} />
              <Skeleton width="80%" height={13} />
            </div>
          </Card>

          <Card>
            <Skeleton width="40%" height={15} className={styles['profile__card-title']} />
            <div className={styles['profile__gallery-skeleton']}>
              {Array.from({ length: GALLERY_SKELETON_COUNT }, (_, index) => (
                <Skeleton key={index} width="100%" height="100%" radius={8} />
              ))}
            </div>
          </Card>

          <Card>
            <Skeleton width="25%" height={15} className={styles['profile__card-title']} />
            <div className={friendsStyles['friends__grid']}>
              {Array.from({ length: FRIENDS_SKELETON_COUNT }, (_, index) => (
                <div key={index} className={friendsStyles['friends__skeleton-tile']}>
                  <Skeleton width={62} height={62} radius="50%" />
                  <Skeleton width="80%" height={11} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className={styles['profile__wall']}>
          {Array.from({ length: WALL_SKELETON_COUNT }, (_, index) => (
            <PostCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
