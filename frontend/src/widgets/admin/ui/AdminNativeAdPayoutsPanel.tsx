'use client';

import { useState } from 'react';
import {
  listPendingNativeAdPayouts,
  processNativeAdPayout,
  type AdminNativeAdPayout,
} from '@/entities/admin';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './AdminNativeAdPayoutsPanel.module.scss';

/**
 * Очередь выплат creator'ам через Stripe Connect (Creator Monetization
 * Phase 5, AI_PLATFORM_ROADMAP.md §83) — creator ЗАПРАШИВАЕТ выплату
 * (`status: pending`), реальный перевод денег происходит только здесь, по
 * явному нажатию «Обработать» — см. backend `NativeAdPayoutsService.process`'s
 * комментарий про самое чувствительное, необратимое действие всей фичи.
 */
export function AdminNativeAdPayoutsPanel() {
  const { status, data, error, refetch } = useAsyncData(listPendingNativeAdPayouts);
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Обработанная выплата (успех/провал) пропадает из `data` сразу после
  // `refetch()` (тот отдаёт только `status: pending`) — без отдельного
  // состояния админ не успел бы увидеть РЕАЛЬНУЮ причину провала Stripe,
  // строка исчезала бы из очереди раньше, чем он прочитает ошибку.
  const [lastResult, setLastResult] = useState<AdminNativeAdPayout | null>(null);
  const [lastResultError, setLastResultError] = useState<string | null>(null);

  async function handleProcess(payout: AdminNativeAdPayout) {
    setProcessingId(payout.id);
    setLastResult(null);
    setLastResultError(null);
    try {
      const result = await processNativeAdPayout(payout.id);
      setLastResult(result);
      await refetch();
    } catch (submitError) {
      setLastResultError(
        submitError instanceof Error ? submitError.message : 'Не удалось обработать',
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card>
      <h3 className={styles['section-title']}>Выплаты на обработку</h3>

      {lastResult && (
        <p className={lastResult.status === 'failed' ? styles.error : styles.success} role="status">
          {formatMoney(lastResult.amountCents, lastResult.currency)} · {lastResult.creatorName}:{' '}
          {lastResult.status === 'paid'
            ? 'выплата выполнена'
            : (lastResult.failureReason ?? 'Stripe отклонил перевод')}
        </p>
      )}
      {lastResultError && (
        <p className={styles.error} role="alert">
          {lastResultError}
        </p>
      )}

      {status === 'loading' && <Loader label="Загружаем очередь выплат…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' && data && data.length === 0 && (
        <EmptyState
          title="Нет выплат, ожидающих обработки"
          description="Здесь появится запрос, когда creator запросит выплату накопленного баланса."
        />
      )}
      {status === 'success' && data && data.length > 0 && (
        <div className={styles.list}>
          {data.map((payout) => (
            <div key={payout.id} className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.rowAmount}>
                  {formatMoney(payout.amountCents, payout.currency)}
                </span>
                <span className={styles.rowMeta}>{payout.creatorName}</span>
              </div>
              <Button
                variant="outline"
                disabled={processingId === payout.id}
                onClick={() => void handleProcess(payout)}
              >
                {processingId === payout.id ? 'Обрабатываем…' : 'Обработать'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
