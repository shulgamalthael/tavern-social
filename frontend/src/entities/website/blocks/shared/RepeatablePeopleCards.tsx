import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { StarIcon } from '@/shared/ui/icons';
import { SectionHeading } from './SectionHeading';
import styles from './primitives.module.scss';

export interface PersonCardItem {
  photo?: string | null;
  name: string;
  role?: string;
  text?: string;
  rating?: number;
}

export interface RepeatablePeopleCardsProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  items: PersonCardItem[];
  columns?: number;
  /** `team` — фото крупно сверху, роль под именем. `quote` — текст цитаты
   * первым, аватар+имя мельче внизу (testimonials). `review` — звёздный
   * рейтинг сверху текста (reviews). Три отдельных типа блока в реестре
   * (`team`/`testimonials`/`reviews`, см. `blocks/business/index.tsx`) с
   * одним движком — они отличаются тем, что важно увидеть первым, не
   * структурой данных. */
  variant?: 'team' | 'quote' | 'review';
}

export function RepeatablePeopleCards({
  eyebrow,
  heading,
  description,
  items,
  columns = 3,
  variant = 'team',
}: RepeatablePeopleCardsProps) {
  return (
    <div className={styles.block}>
      <SectionHeading eyebrow={eyebrow} heading={heading} description={description} />
      <div className={styles['people-grid']} style={{ '--grid-columns': columns } as CSSProperties}>
        {items.map((item, index) => (
          <div key={index} className={cn(styles['people-card'], styles[`people-card--${variant}`])}>
            {variant === 'review' && item.rating !== undefined && (
              <div
                className={styles['people-card__rating']}
                aria-label={`Оценка ${item.rating} из 5`}
              >
                {Array.from({ length: 5 }, (_, starIndex) => (
                  <StarIcon
                    key={starIndex}
                    className={
                      starIndex < item.rating!
                        ? styles['people-card__star--filled']
                        : styles['people-card__star']
                    }
                  />
                ))}
              </div>
            )}

            {variant === 'team' &&
              (item.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото, не подходит под next/image
                <img src={item.photo} alt="" className={styles['people-card__photo']} />
              ) : (
                <span className={styles['people-card__photo-placeholder']}>
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
              ))}

            {item.text && <p className={styles['people-card__text']}>{item.text}</p>}

            <div className={styles['people-card__byline']}>
              {variant !== 'team' &&
                (item.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- см. выше
                  <img src={item.photo} alt="" className={styles['people-card__avatar']} />
                ) : (
                  <span className={styles['people-card__avatar-placeholder']}>
                    {item.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              <span className={styles['people-card__byline-text']}>
                <span className={styles['people-card__name']}>{item.name}</span>
                {item.role && <span className={styles['people-card__role']}>{item.role}</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
