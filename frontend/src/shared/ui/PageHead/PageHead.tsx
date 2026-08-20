import type { ReactNode } from 'react';
import styles from './PageHead.module.scss';

export interface PageHeadProps {
  title: string;
  description?: ReactNode;
}

/** Заголовок раздела + подпись — повторяющийся паттерн шапок страниц. */
export function PageHead({ title, description }: PageHeadProps) {
  return (
    <div className={styles['page-head']}>
      <h1 className={styles['page-head__title']}>{title}</h1>
      {description && <span className={styles['page-head__description']}>{description}</span>}
    </div>
  );
}
