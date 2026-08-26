import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { BanIcon } from '@/shared/ui/icons';
import { endSession } from '../api/actions';
import styles from './BannedNotice.module.scss';

export interface BannedNoticeProps {
  /** Готовое сообщение от backend (`SessionAuthGuard`) — уже включает
   * причину бана, если админ её указал при блокировке. */
  message: string;
}

/**
 * Показывается вместо всего защищённого приложения, когда `(protected)/
 * layout.tsx` ловит `BannedError` из `getSessionUser()` — не редирект на
 * `/auth` (там просто попросили бы войти снова тем же забаненным
 * аккаунтом), а честный экран «доступ закрыт», с той же причиной, что
 * видит админ на вкладке «Пользователи» в админке.
 */
export function BannedNotice({ message }: BannedNoticeProps) {
  return (
    <main className={styles.banned}>
      <Card className={styles['banned__card']}>
        <span className={styles['banned__icon']}>
          <BanIcon width={26} height={26} />
        </span>
        <h1 className={styles['banned__title']}>Доступ в зал закрыт</h1>
        <p className={styles['banned__message']}>{message}</p>
        <p className={styles['banned__hint']}>
          Если считаете это ошибкой — свяжитесь с администрацией зала.
        </p>
        <form action={endSession}>
          <Button type="submit" variant="outline">
            Выйти
          </Button>
        </form>
      </Card>
    </main>
  );
}
