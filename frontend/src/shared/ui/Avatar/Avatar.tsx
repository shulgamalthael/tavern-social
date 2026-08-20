import { cn } from '@/shared/lib/cn';
import styles from './Avatar.module.scss';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  initials: string;
  size?: AvatarSize;
  /** Точка «в зале» — пользователь сейчас онлайн. */
  online?: boolean;
  /** Рамка под цвет фона — для аватара на обложке профиля. */
  bordered?: boolean;
  className?: string;
}

export function Avatar({ initials, size = 'md', online, bordered, className }: AvatarProps) {
  return (
    <span
      className={cn(
        styles.avatar,
        styles[`avatar--${size}`],
        bordered && styles['avatar--bordered'],
        className,
      )}
    >
      {initials}
      {online && <span className={styles['avatar__presence-dot']} aria-hidden="true" />}
    </span>
  );
}
