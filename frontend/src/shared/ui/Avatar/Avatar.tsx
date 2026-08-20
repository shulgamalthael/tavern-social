import { cn } from '@/shared/lib/cn';
import styles from './Avatar.module.scss';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  initials: string;
  /** Картинка аватара — если задана, рисуется вместо инициалов. */
  src?: string | null;
  size?: AvatarSize;
  /** Точка «в зале» — пользователь сейчас онлайн. */
  online?: boolean;
  /** Рамка под цвет фона — для аватара на обложке профиля. */
  bordered?: boolean;
  className?: string;
}

export function Avatar({ initials, src, size = 'md', online, bordered, className }: AvatarProps) {
  return (
    <span
      className={cn(
        styles.avatar,
        styles[`avatar--${size}`],
        bordered && styles['avatar--bordered'],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- произвольные загруженные аватары, не подходят под статическую оптимизацию next/image
        <img className={styles['avatar__image']} src={src} alt="" />
      ) : (
        initials
      )}
      {online && <span className={styles['avatar__presence-dot']} aria-hidden="true" />}
    </span>
  );
}
