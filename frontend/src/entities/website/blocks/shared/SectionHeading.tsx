import { cn } from '@/shared/lib/cn';
import styles from './primitives.module.scss';

export interface SectionHeadingProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  align?: 'left' | 'center';
}

/** Эйебрау + заголовок + подпись — общая шапка секции, которую использует
 * добрая половина бизнес-блоков (Hero/About/Services/Team/Testimonials/
 * Pricing/FAQ/Stats и т. д., см. `blocks/business`, `blocks/content`) —
 * заведена один раз здесь, а не копипастой в каждом. */
export function SectionHeading({
  eyebrow,
  heading,
  description,
  align = 'center',
}: SectionHeadingProps) {
  if (!eyebrow && !heading && !description) return null;

  return (
    <div className={cn(styles['heading'], align === 'left' && styles['heading--left'])}>
      {eyebrow && <span className={styles['heading__eyebrow']}>{eyebrow}</span>}
      {heading && <h2 className={styles['heading__title']}>{heading}</h2>}
      {description && <p className={styles['heading__description']}>{description}</p>}
    </div>
  );
}
