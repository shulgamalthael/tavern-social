import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'outline' | 'soft' | 'ghost' | 'chip';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.button,
        styles[`button--${variant}`],
        fullWidth && styles['button--full-width'],
        className,
      )}
      {...rest}
    />
  );
}
