import type { CSSProperties } from 'react';
import { EditableText } from '../../ui/EditableText';
import { resolveIconChoice } from './icon-choices';
import { SectionHeading } from './SectionHeading';
import styles from './primitives.module.scss';

export interface IconCardItem {
  icon?: string;
  title: string;
  description: string;
}

export interface RepeatableIconCardsProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  items: IconCardItem[];
  columns?: number;
  editable?: boolean;
  onEditEyebrow?: (value: string) => void;
  onEditHeading?: (value: string) => void;
  onEditDescription?: (value: string) => void;
  /** Поле одного элемента `items` — `index` тот же, что у `items[index]`,
   * так вызывающий блок (`ServicesRenderer`/`FeatureGridRenderer`) может
   * собрать новый массив и отдать его целиком через свой `onEditProp('items',
   * next)`, не зная здесь ничего о структуре пропсов блока-владельца. */
  onEditItem?: (index: number, field: 'title' | 'description', value: string) => void;
}

/** Сетка «иконка + заголовок + текст» — общий движок `services` и
 * `featuregrid` (структурно один и тот же блок, разные дефолты и место в
 * каталоге, см. `blocks/business/index.tsx`/`blocks/content/index.tsx`). */
export function RepeatableIconCards({
  eyebrow,
  heading,
  description,
  items,
  columns = 3,
  editable,
  onEditEyebrow,
  onEditHeading,
  onEditDescription,
  onEditItem,
}: RepeatableIconCardsProps) {
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
      <div className={styles['icon-grid']} style={{ '--grid-columns': columns } as CSSProperties}>
        {items.map((item, index) => {
          const Icon = resolveIconChoice(item.icon);
          return (
            <div key={index} className={styles['icon-card']}>
              <span className={styles['icon-card__icon']}>
                <Icon />
              </span>
              <EditableText
                as="h3"
                value={item.title}
                editable={itemEditable}
                onCommit={(value) => onEditItem?.(index, 'title', value)}
                placeholder="Заголовок карточки"
                className={styles['icon-card__title']}
              />
              {(item.description || itemEditable) && (
                <EditableText
                  as="p"
                  value={item.description}
                  editable={itemEditable}
                  onCommit={(value) => onEditItem?.(index, 'description', value)}
                  placeholder="Текст карточки"
                  className={styles['icon-card__description']}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
