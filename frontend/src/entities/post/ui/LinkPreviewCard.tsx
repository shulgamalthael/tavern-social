import type { LinkPreview } from '../model/types';
import styles from './LinkPreviewCard.module.scss';

export interface LinkPreviewCardProps {
  preview: LinkPreview;
}

/** Карточка превью внешней ссылки под текстом поста — только для ссылок, у
 * которых backend успел получить метаданные (см. `entities/post/model/
 * types.ts#LinkPreview`). Ссылка внутри самого текста продолжает работать
 * независимо от того, есть ли для неё карточка. */
export function LinkPreviewCard({ preview }: LinkPreviewCardProps) {
  return (
    <a
      className={styles['link-preview']}
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {preview.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- превью с произвольного внешнего домена, не оптимизируемый Next Image-контент
        <img className={styles['link-preview__image']} src={preview.imageUrl} alt="" />
      )}
      <div className={styles['link-preview__body']}>
        <span className={styles['link-preview__domain']}>{preview.domain}</span>
        {preview.title && <span className={styles['link-preview__title']}>{preview.title}</span>}
        {preview.description && (
          <span className={styles['link-preview__description']}>{preview.description}</span>
        )}
      </div>
    </a>
  );
}
