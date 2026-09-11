import type { CSSProperties } from 'react';
import { resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget, WebsitePage } from '../../model/types';
import { EditableText } from '../../ui/EditableText';
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
  editable?: boolean;
  onEditEyebrow?: (value: string) => void;
  onEditHeading?: (value: string) => void;
  onEditDescription?: (value: string) => void;
  /** См. `RepeatableIconCardsProps.onEditItem`. `title` намеренно не
   * редактируется на холсте, когда карточка реально ссылается куда-то
   * (`hasLink` ниже) — обёрнутый в `<a href>` текст сделал бы первый клик
   * переходом по ссылке вместо входа в редактирование (билдер не перехватывает
   * клики по вложенным `<a>`, тот же риск, что и у кнопки, `SiteButton`,
   * `blocks/actions/index.tsx`, — там по той же причине текст кнопки тоже
   * остался редактируемым только через форму); `description` этому риску не
   * подвержен и редактируется всегда. */
  onEditItem?: (index: number, field: 'title' | 'description', value: string) => void;
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
  editable,
  onEditEyebrow,
  onEditHeading,
  onEditDescription,
  onEditItem,
}: RepeatableSimpleCardsProps) {
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
                {hasLink ? (
                  <h3 className={styles['simple-card__title']}>
                    <a href={href}>{item.title}</a>
                  </h3>
                ) : (
                  <EditableText
                    as="h3"
                    value={item.title}
                    editable={itemEditable}
                    onCommit={(value) => onEditItem?.(index, 'title', value)}
                    placeholder="Заголовок карточки"
                    className={styles['simple-card__title']}
                  />
                )}
                {(item.description || itemEditable) && (
                  <EditableText
                    as="p"
                    value={item.description ?? ''}
                    editable={itemEditable}
                    onCommit={(value) => onEditItem?.(index, 'description', value)}
                    placeholder="Текст карточки"
                    className={styles['simple-card__description']}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
