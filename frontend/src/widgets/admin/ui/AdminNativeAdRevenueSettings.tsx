'use client';

import { useState } from 'react';
import {
  getNativeAdRevenueSettings,
  updateNativeAdRevenueSettings,
  type NativeAdRevenueSettings,
} from '@/entities/admin';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import styles from './AdminNativeAdRevenueSettings.module.scss';

function bpsToPercentString(bps: number): string {
  return (bps / 100).toString();
}

function percentStringToBps(value: string): number {
  return Math.round(parseFloat(value || '0') * 100);
}

/**
 * Админ-конфигурируемые проценты распределения выручки (корневой план
 * фичи — "creator share, platform fee, payment processing fee, minimum
 * payout — НЕ хардкод"). Три доли валидируются в сумме на 100% на backend
 * (`NativeAdRevenueSettingsService.update`) — здесь только показываем
 * текущую сумму, чтобы админ видел проблему ДО сабмита, а не только после
 * ответа backend с ошибкой.
 */
export function AdminNativeAdRevenueSettings() {
  const { status, data, error, refetch } = useAsyncData(getNativeAdRevenueSettings);

  if (status === 'loading') return <Loader label="Загружаем настройки распределения…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return <SettingsForm initial={data} onSaved={refetch} />;
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: NativeAdRevenueSettings;
  onSaved: () => void;
}) {
  const [creatorShare, setCreatorShare] = useState(
    bpsToPercentString(initial.creatorRevenueShareBps),
  );
  const [platformFee, setPlatformFee] = useState(bpsToPercentString(initial.platformFeeBps));
  const [processingFee, setProcessingFee] = useState(
    bpsToPercentString(initial.paymentProcessingFeeBps),
  );
  const [minimumPayout, setMinimumPayout] = useState(String(initial.minimumPayoutCents / 100));
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const total =
    parseFloat(creatorShare || '0') +
    parseFloat(platformFee || '0') +
    parseFloat(processingFee || '0');
  const totalIsValid = Math.round(total * 100) === 10000;

  async function handleSave() {
    if (!totalIsValid) {
      setError('Три доли должны в сумме давать 100%');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateNativeAdRevenueSettings({
        creatorRevenueShareBps: percentStringToBps(creatorShare),
        platformFeeBps: percentStringToBps(platformFee),
        paymentProcessingFeeBps: percentStringToBps(processingFee),
        minimumPayoutCents: Math.round(parseFloat(minimumPayout || '0') * 100),
      });
      onSaved();
      setSaved(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось сохранить настройки',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={styles.card}>
      <h3 className={styles.title}>Распределение выручки</h3>
      <p className={styles.hint}>
        Как делится каждый доллар, списанный с бюджета рекламодателя за показ/клик рекламы в ленте.
      </p>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Доля creator&rsquo;а, %</span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={creatorShare}
            onChange={(event) => setCreatorShare(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Комиссия платформы, %</span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={platformFee}
            onChange={(event) => setPlatformFee(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Обработка платежа, %</span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.input}
            value={processingFee}
            onChange={(event) => setProcessingFee(event.target.value)}
          />
        </label>
      </div>

      <p className={totalIsValid ? styles.totalOk : styles.totalError}>
        Сумма: {total.toFixed(2)}%
      </p>

      <label className={styles.field}>
        <span className={styles.label}>
          Минимальная сумма выплаты (
          {formatMoney(Math.round(parseFloat(minimumPayout || '0') * 100), 'USD')})
        </span>
        <input
          type="text"
          inputMode="decimal"
          className={styles.input}
          value={minimumPayout}
          onChange={(event) => setMinimumPayout(event.target.value)}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className={styles.saved}>Настройки сохранены</p>}

      <Button disabled={isSaving || !totalIsValid} onClick={() => void handleSave()}>
        {isSaving ? 'Сохраняем…' : 'Сохранить'}
      </Button>
    </Card>
  );
}
