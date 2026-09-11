import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { GlobeIcon, StarIcon } from '@/shared/ui/icons';
import { EditableText } from '../../ui/EditableText';
import { SectionHeading } from './SectionHeading';
import styles from './primitives.module.scss';

export interface PersonCardItem {
  photo?: string | null;
  name: string;
  role?: string;
  text?: string;
  rating?: number;
  /** Только у `teamsocial` (`blocks/business/index.tsx`) — необязательное
   * поле, `team`/`testimonials`/`reviews` его не читают и не задают, так
   * что для них ничего не меняется. Иконка одна и та же для любой
   * платформы (как у `sociallinks`/`socialshare`) — курируемых
   * платформо-специфичных иконок в проекте нет. */
  socialLinks?: { platform: string; url: string }[];
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
  /** `grid` (по умолчанию) — обычная равномерная сетка. `masonry` — стена
   * карточек CSS-колонками (`column-count`), карточки разной высоты не
   * тянутся до одного уровня — используется `testimonialwall`, см.
   * `blocks/business/index.tsx`. Модификатор ставится и на контейнер, и на
   * саму карточку (`people-card--masonry`) — не через селектор-потомок
   * `.people-grid--masonry .people-card`, тот запрещён (`AGENTS.md` §6). */
  layout?: 'grid' | 'masonry';
  editable?: boolean;
  onEditEyebrow?: (value: string) => void;
  onEditHeading?: (value: string) => void;
  onEditDescription?: (value: string) => void;
  /** См. `RepeatableIconCardsProps.onEditItem` — тот же принцип: вызывающий
   * блок отдаёт новый `items` целиком через свой `onEditProp`. */
  onEditItem?: (index: number, field: 'name' | 'role' | 'text', value: string) => void;
}

export function RepeatablePeopleCards({
  eyebrow,
  heading,
  description,
  items,
  columns = 3,
  variant = 'team',
  layout = 'grid',
  editable,
  onEditEyebrow,
  onEditHeading,
  onEditDescription,
  onEditItem,
}: RepeatablePeopleCardsProps) {
  const itemEditable = editable && Boolean(onEditItem);
  return (
    <div className={styles.block}>
      <SectionHeading
        eyebrow={eyebrow}
        heading={heading}
        description={description}
        editable={editable}
        onEditEyebrow={onEditEyebrow}
        onEditHeading={onEditHeading}
        onEditDescription={onEditDescription}
      />
      <div
        className={cn(
          styles['people-grid'],
          layout === 'masonry' && styles['people-grid--masonry'],
        )}
        style={{ '--grid-columns': columns } as CSSProperties}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              styles['people-card'],
              styles[`people-card--${variant}`],
              layout === 'masonry' && styles['people-card--masonry'],
            )}
          >
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

            {(item.text || (itemEditable && variant !== 'team')) && (
              <EditableText
                as="p"
                value={item.text ?? ''}
                editable={itemEditable && variant !== 'team'}
                onCommit={(value) => onEditItem?.(index, 'text', value)}
                placeholder="Текст отзыва"
                className={styles['people-card__text']}
              />
            )}

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
                <EditableText
                  as="span"
                  value={item.name}
                  editable={itemEditable}
                  onCommit={(value) => onEditItem?.(index, 'name', value)}
                  placeholder="Имя"
                  className={styles['people-card__name']}
                />
                {(item.role || itemEditable) && (
                  <EditableText
                    as="span"
                    value={item.role ?? ''}
                    editable={itemEditable}
                    onCommit={(value) => onEditItem?.(index, 'role', value)}
                    placeholder="Роль"
                    className={styles['people-card__role']}
                  />
                )}
              </span>
            </div>

            {item.socialLinks && item.socialLinks.length > 0 && (
              <div className={styles['people-card__socials']}>
                {item.socialLinks.map((link, linkIndex) => (
                  <a
                    key={linkIndex}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.platform}
                    className={styles['people-card__social-link']}
                  >
                    <GlobeIcon />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
