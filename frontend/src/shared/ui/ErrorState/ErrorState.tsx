import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import styles from './ErrorState.module.scss';

export interface ErrorStateProps {
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Ошибка загрузки — не пустое состояние: показывает, что запрос не удался,
 * и (если передан `onRetry`) даёт повторить попытку.
 */
export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn(styles['error-state'], className)} role="alert">
      <p className={styles['error-state__title']}>Не получилось загрузить данные</p>
      {message && <p className={styles['error-state__description']}>{message}</p>}
      {onRetry && (
        <Button variant="outline" className={styles['error-state__action']} onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
