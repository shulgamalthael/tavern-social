import type { CSSProperties } from 'react';
import { resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget, WebsitePage } from '../../model/types';
import { SectionHeading } from './SectionHeading';
import styles from './primitives.module.scss';

export interface SimpleCardItem {
  image?: string | null;
  title: string;
  description?: string;
  meta?: string;
  url?: LinkTarget;
}

export interface RepeatableSimpleCardsProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  items: SimpleCardItem[];
  columns?: number;
  pages: WebsitePage[];
}

/** Карточка «картинка сверху + заголовок + текст (+ маленькая мета-строка —
 * дата у статьи, цена у товара и т. п.)» — движок `cards`/`articles` (см.
 * `blocks/content/index.tsx`), различаются только дефолтами (у статей
 * `meta` — дата, у обычных карточек её обычно нет). `url` не задан —
 * реальная ссылка не нужна (`resolveLinkHref` вернула бы `'#'`, а `'#'`
 * ведёт в никуда — лучше вообще не оборачивать в `<a>`, чем притворяться
 * кликабельностью). */
export function RepeatableSimpleCards({
  eyebrow,
  heading,
  description,
  items,
  columns = 3,
  pages,
}: RepeatableSimpleCardsProps) {
  return (
    <div className={styles.block}>
      <SectionHeading eyebrow={eyebrow} heading={heading} description={description} />
      <div className={styles['simple-grid']} style={{ '--grid-columns': columns } as CSSProperties}>
        {items.map((item, index) => {
          const href = item.url ? resolveLinkHref(item.url, pages) : undefined;
          const hasLink = Boolean(href) && href !== '#';

          return (
            <div key={index} className={styles['simple-card']}>
              {item.image &&
                (hasLink ? (
                  <a href={href}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото, не подходит под next/image */}
                    <img src={item.image} alt="" className={styles['simple-card__image']} />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- см. выше
                  <img src={item.image} alt="" className={styles['simple-card__image']} />
                ))}
              <div className={styles['simple-card__body']}>
                {item.meta && <span className={styles['simple-card__meta']}>{item.meta}</span>}
                <h3 className={styles['simple-card__title']}>
                  {hasLink ? <a href={href}>{item.title}</a> : item.title}
                </h3>
                {item.description && (
                  <p className={styles['simple-card__description']}>{item.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
