import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LocationIcon, TagIcon } from '@/shared/ui/icons';
import { Tag } from '@/shared/ui/Tag';
import styles from './AboutCard.module.scss';
import profileStyles from './ProfileWidget.module.scss';

export interface AboutCardProps {
  about: string | null;
  city: string | null;
  tags: string[];
  /** Своя страница — пустое состояние подсказывает, как заполнить профиль;
   * чужая — просто честно говорит, что информации нет (заполнить может
   * только сам владелец). */
  isOwn: boolean;
}

/**
 * Карточка «О себе» — три содержательно разных вещи (свободный текст,
 * город, интересы), которые раньше шли одинаковыми `<p>` подряд и
 * визуально сливались в один абзац. Здесь каждая — свой блок с подписью и
 * значком, разделены тонкой линией, поэтому читаются как отдельные
 * пункты профиля, а не как один сплошной текст.
 */
export function AboutCard({ about, city, tags, isOwn }: AboutCardProps) {
  const hasTags = tags.length > 0;
  const hasContent = Boolean(about) || Boolean(city) || hasTags;

  return (
    <Card>
      <h2 className={profileStyles['profile__card-title']}>О себе</h2>
      {hasContent ? (
        <div className={styles['about']}>
          {about && <p className={styles['about__bio']}>{about}</p>}
          {city && (
            <div className={styles['about__row']}>
              <LocationIcon className={styles['about__row-icon']} />
              <span>{city}</span>
            </div>
          )}
          {hasTags && (
            <div className={styles['about__section']}>
              <span className={styles['about__section-label']}>
                <TagIcon className={styles['about__row-icon']} />
                Интересы
              </span>
              <div className={styles['about__tags']}>
                {tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="Пока нет информации о себе"
          description={isOwn ? 'Расскажите о себе — нажмите «Править страницу».' : undefined}
        />
      )}
    </Card>
  );
}
