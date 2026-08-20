import { cn } from '@/shared/lib/cn';
import styles from './Loader.module.scss';

export interface LoaderProps {
  label?: string;
  className?: string;
}

/** Данные ещё загружаются — не показывайте `EmptyState`, пока не пришёл ответ. */
export function Loader({ label = 'Загрузка…', className }: LoaderProps) {
  return (
    <div className={cn(styles.loader, className)} role="status" aria-live="polite">
      <span className={styles.loader__dot} aria-hidden="true" />
      {label}
    </div>
  );
}
