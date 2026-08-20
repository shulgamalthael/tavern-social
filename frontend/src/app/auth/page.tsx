import type { Metadata } from 'next';
import { AuthForm } from '@/features/auth';
import { Card } from '@/shared/ui/Card';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Вход — Таверна',
  description: 'Представьтесь, чтобы войти в зал.',
};

export default function AuthPage() {
  return (
    <main className={styles.auth}>
      <Card className={styles['auth__card']}>
        <span className={styles['auth__logo-dot']} aria-hidden="true" />
        <h1 className={styles['auth__title']}>Таверна</h1>
        <p className={styles['auth__subtitle']}>
          Тёплый зал для разговоров, сборов и старых друзей. Представьтесь, чтобы войти.
        </p>
        <AuthForm />
      </Card>
    </main>
  );
}
