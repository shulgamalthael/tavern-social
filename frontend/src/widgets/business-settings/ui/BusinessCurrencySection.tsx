'use client';

import { useState } from 'react';
import { TAX_MODE_LABELS, updateBusiness, type Business, type TaxMode } from '@/entities/business';
import { CURRENCY_OPTIONS, getCurrencyMetadata } from '@/shared/config/currencies';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import styles from './BusinessSettingsWidget.module.scss';

const TAX_MODE_OPTIONS: TaxMode[] = ['none', 'exclusive', 'inclusive'];

/** `2000` (базисные пункты) ↔ `"20"` (проценты для поля ввода) — те же
 * базисные пункты, что хранит `Business.taxRateBps`, но человеку понятнее
 * видеть "20", чем "2000". Не денежная величина, поэтому не через
 * `formatMoney`/`toMinorUnits` (те — про минимальные единицы КОНКРЕТНОЙ
 * валюты, ставка налога — universal percentage, не привязана к валюте). */
function bpsToPercentString(bps: number): string {
  return (bps / 100).toString();
}

function percentStringToBps(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * 100);
}

export interface BusinessCurrencySectionProps {
  business: Business;
  onSaved: (business: Business) => void;
}

/**
 * «Валюта и платежи» (Currency System, ROADMAP.md §8) — единственное место
 * в проекте, где меняется `Business.currency`. Выбор новой валюты НЕ
 * сохраняется сразу же по изменению `<select>` — открывается модалка с
 * явным предупреждением ("Changing the business currency does not
 * automatically convert existing prices", см. задачу): у уже созданных
 * `Product`/`Service` числовое значение цены останется тем же самым, просто
 * начнёт показываться в другой валюте (100 → "100 ₴" превратится в
 * "100 $"), а не будет пересчитано по курсу. Владелец должен явно
 * подтвердить, что понимает это, а не молча получить рассинхронизацию цен
 * с реальной стоимостью товара.
 *
 * «Налог» (Pricing Engine, Phase 17 — см. `PRICING_ARCHITECTURE.md` §3) —
 * один плоский тариф на бизнес, сохраняется отдельной кнопкой без
 * предупреждающей модалки (в отличие от валюты выше): смена налога не
 * переписывает прошлые заказы (у тех — свой снэпшот `taxCents`, см.
 * `Order`), так что здесь нечего необратимо «сломать» задним числом.
 */
export function BusinessCurrencySection({ business, onSaved }: BusinessCurrencySectionProps) {
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [taxMode, setTaxMode] = useState<TaxMode>(business.taxMode);
  const [taxRatePercent, setTaxRatePercent] = useState(bpsToPercentString(business.taxRateBps));
  const [isSavingTax, setSavingTax] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  const currentMetadata = getCurrencyMetadata(business.currency);

  async function saveTax() {
    const taxRateBps = taxMode === 'none' ? 0 : percentStringToBps(taxRatePercent);
    if (taxRateBps === null) {
      setTaxError('Введите ставку от 0 до 100');
      return;
    }
    setSavingTax(true);
    setTaxError(null);
    try {
      const updated = await updateBusiness(business.id, { taxMode, taxRateBps });
      onSaved(updated);
    } catch (submitError) {
      setTaxError(
        submitError instanceof Error ? submitError.message : 'Не удалось сохранить налог',
      );
    } finally {
      setSavingTax(false);
    }
  }

  async function confirmChange() {
    if (!pendingCurrency) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBusiness(business.id, { currency: pendingCurrency });
      onSaved(updated);
      setPendingCurrency(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось изменить валюту');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles['section__head']}>
        <div>
          <h2 className={styles['section__title']}>Валюта и платежи</h2>
          <p className={styles['section__hint']}>
            Основная валюта — в ней указываются цены товаров и услуг, оформляются заказы и записи, и
            принимается оплата через Stripe.
          </p>
        </div>
      </div>

      <div className={styles.seoForm}>
        <label className={styles.seoField}>
          <span className={styles.seoLabel}>Основная валюта</span>
          <select
            className={styles.seoInput}
            value={business.currency}
            onChange={(event) => setPendingCurrency(event.target.value)}
          >
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <label className={styles.seoField}>
          <span className={styles.seoLabel}>Налог</span>
          <select
            className={styles.seoInput}
            value={taxMode}
            onChange={(event) => setTaxMode(event.target.value as TaxMode)}
          >
            {TAX_MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {TAX_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>

        {taxMode !== 'none' && (
          <label className={styles.seoField}>
            <span className={styles.seoLabel}>Ставка налога, %</span>
            <input
              type="text"
              inputMode="decimal"
              className={styles.seoInput}
              value={taxRatePercent}
              onChange={(event) => setTaxRatePercent(event.target.value)}
              placeholder="20"
            />
          </label>
        )}

        {taxError && (
          <p className={styles.error} role="alert">
            {taxError}
          </p>
        )}

        <Button
          variant="outline"
          onClick={() => void saveTax()}
          disabled={
            isSavingTax ||
            (taxMode === business.taxMode &&
              taxRatePercent === bpsToPercentString(business.taxRateBps))
          }
        >
          {isSavingTax ? 'Сохраняем…' : 'Сохранить налог'}
        </Button>
      </div>

      {pendingCurrency && pendingCurrency !== business.currency && (
        <Modal onClose={() => setPendingCurrency(null)} label="Смена валюты">
          <div className={styles.confirm}>
            <h2>
              Сменить валюту на {getCurrencyMetadata(pendingCurrency).name} (
              {getCurrencyMetadata(pendingCurrency).code})?
            </h2>
            <p className={styles['confirm__hint']}>
              Цены существующих товаров и услуг НЕ будут автоматически пересчитаны по курсу — то же
              число «{100}» просто начнёт показываться как «{currentMetadata.symbol}100» → «
              {getCurrencyMetadata(pendingCurrency).symbol}100». Проверьте и поправьте цены вручную
              после смены, если это не то, что нужно. Уже оформленные заказы и записи сохранят
              валюту, в которой были созданы, и не изменятся.
            </p>
            <div className={styles['confirm__actions']}>
              <Button variant="outline" onClick={() => setPendingCurrency(null)}>
                Отмена
              </Button>
              <Button onClick={() => void confirmChange()} disabled={isSaving}>
                {isSaving ? 'Меняем…' : 'Сменить валюту'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
