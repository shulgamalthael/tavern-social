'use client';

import { useCallback } from 'react';
import { getLoyaltyAccounts } from '@/entities/rule';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './LoyaltyAccountsSection.module.scss';

export interface LoyaltyAccountsSectionProps {
  businessId: string;
}

/** Накопленные баллы/тиры покупателей — заполняется действиями
 * `add_loyalty_points`/`set_membership_tier` (см. `entities/rule`'s
 * `RuleAction`), сама секция read-only: баллы/тиры выставляются только
 * правилами, не редактируются владельцем вручную в этой итерации. */
export function LoyaltyAccountsSection({ businessId }: LoyaltyAccountsSectionProps) {
  const fetcher = useCallback(() => getLoyaltyAccounts(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем программу лояльности…" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="Пока нет ни одного покупателя с баллами"
        description="Добавьте правило с действием «Начислить баллы» или «Установить статус» — баллы появятся здесь после первого подходящего заказа/записи с email покупателя."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {data.map((account) => (
        <li key={account.id} className={styles.row}>
          <span className={styles.row__email}>{account.email}</span>
          <span className={styles.row__points}>{account.points} баллов</span>
          {account.tier && <span className={styles.row__tier}>{account.tier}</span>}
        </li>
      ))}
    </ul>
  );
}
